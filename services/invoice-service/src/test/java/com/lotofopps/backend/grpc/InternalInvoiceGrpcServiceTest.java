package com.lotofopps.backend.grpc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import com.lotofopps.backend.service.LlmChatEmbeddingService;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

class InternalInvoiceGrpcServiceTest {

    private static final String USER = "user-42";

    private InvoiceRepository invoiceRepository;
    private DocumentRepository documentRepository;
    private DocumentStorageService documentStorageService;
    private LlmChatEmbeddingService embeddingService;
    private InternalInvoiceGrpcService service;

    @BeforeEach
    void setUp() {
        invoiceRepository = mock(InvoiceRepository.class);
        documentRepository = mock(DocumentRepository.class);
        documentStorageService = mock(DocumentStorageService.class);
        embeddingService = mock(LlmChatEmbeddingService.class);
        service =
                new InternalInvoiceGrpcService(
                        invoiceRepository,
                        documentRepository,
                        documentStorageService,
                        embeddingService);
        when(invoiceRepository.save(any(Invoice.class)))
                .thenAnswer(
                        invocation -> {
                            Invoice saved = invocation.getArgument(0);
                            // Mirrors IDENTITY generation: real save() populates a null id
                            // synchronously. Only createInvoice's brand-new entities hit this.
                            if (saved.getId() == null) {
                                ReflectionTestUtils.setField(saved, "id", 99L);
                            }
                            return saved;
                        });
    }

    @Test
    void limitZeroMeansAllInvoicesRatherThanACrash() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(invoiceRepository.findByUserIdAndStatus(
                        eq(USER), eq(InvoiceStatus.ACCEPTED), pageable.capture()))
                .thenReturn(Page.empty());

        service.getLatestInvoices(
                GetLatestInvoicesRequest.newBuilder().setUserId(USER).build(),
                new RecordingObserver<>());

        assertThat(pageable.getValue().isUnpaged()).isTrue();
    }

    @Test
    void yearFilterUsesTheYearScopedQuery() {
        when(invoiceRepository.findByUserIdAndStatusAndInvoiceDateYear(
                        eq(USER), eq(InvoiceStatus.ACCEPTED), eq(2025), any()))
                .thenReturn(Page.empty());

        service.getLatestInvoices(
                GetLatestInvoicesRequest.newBuilder().setUserId(USER).setInvoiceYear(2025).build(),
                new RecordingObserver<>());

        verify(invoiceRepository)
                .findByUserIdAndStatusAndInvoiceDateYear(
                        eq(USER), eq(InvoiceStatus.ACCEPTED), eq(2025), any());
    }

    @Test
    void documentsAreScopedToTheUserAndTheRequestedIds() {
        Document document = document(7L, USER);
        when(documentRepository.findByUserIdAndIdIn(USER, List.of(7L, 8L)))
                .thenReturn(List.of(document));

        RecordingObserver<GetDocumentsResponse> observer = new RecordingObserver<>();
        service.getDocuments(
                GetDocumentsRequest.newBuilder()
                        .setUserId(USER)
                        .addAllDocumentIds(List.of(7L, 8L))
                        .build(),
                observer);

        assertThat(observer.value.getDocumentsList())
                .extracting(com.lotofopps.backend.grpc.Document::getId)
                .containsExactly(7L);
        assertThat(observer.value.getDocuments(0).getFilename()).isEqualTo("receipt.pdf");
    }

    @Test
    void servesTheContentOfAnOwnedDocument() {
        when(documentRepository.findById(7L)).thenReturn(Optional.of(document(7L, USER)));
        when(documentStorageService.loadBytes("s3/receipt")).thenReturn("%PDF-1.4".getBytes());

        RecordingObserver<GetDocumentContentResponse> observer = new RecordingObserver<>();
        service.getDocumentContent(
                GetDocumentContentRequest.newBuilder().setUserId(USER).setDocumentId(7L).build(),
                observer);

        assertThat(observer.value.getContent().toStringUtf8()).isEqualTo("%PDF-1.4");
    }

    @Test
    void foreignAndMissingDocumentsAreTheSameNotFound() {
        when(documentRepository.findById(7L)).thenReturn(Optional.of(document(7L, "someone-else")));
        when(documentRepository.findById(8L)).thenReturn(Optional.empty());

        for (long id : Set.of(7L, 8L)) {
            RecordingObserver<GetDocumentContentResponse> observer = new RecordingObserver<>();
            service.getDocumentContent(
                    GetDocumentContentRequest.newBuilder()
                            .setUserId(USER)
                            .setDocumentId(id)
                            .build(),
                    observer);

            assertThat(observer.error).isInstanceOf(StatusRuntimeException.class);
            assertThat(((StatusRuntimeException) observer.error).getStatus().getCode())
                    .isEqualTo(Status.NOT_FOUND.getCode());
        }
    }

    @Test
    void updateInvoicePatchesOnlyFieldsPresentAndReembedsWhenAccepted() {
        Invoice invoice = invoice(7L, USER, "old item", new BigDecimal("10.00"));
        when(invoiceRepository.findById(7L)).thenReturn(Optional.of(invoice));

        RecordingObserver<UpdateInvoiceResponse> observer = new RecordingObserver<>();
        service.updateInvoice(
                UpdateInvoiceRequest.newBuilder()
                        .setUserId(USER)
                        .setInvoiceId(7L)
                        .setItemName("new item")
                        .build(),
                observer);

        assertThat(observer.value.getInvoice().getItemName()).isEqualTo("new item");
        assertThat(observer.value.getInvoice().getPrice()).isEqualTo("10.00");
        verify(embeddingService).embedInvoice(invoice);
    }

    @Test
    void updateInvoiceRejectsInvalidCategory() {
        when(invoiceRepository.findById(7L))
                .thenReturn(Optional.of(invoice(7L, USER, "item", new BigDecimal("10.00"))));

        RecordingObserver<UpdateInvoiceResponse> observer = new RecordingObserver<>();
        service.updateInvoice(
                UpdateInvoiceRequest.newBuilder()
                        .setUserId(USER)
                        .setInvoiceId(7L)
                        .setCategory("NOT_A_REAL_CATEGORY")
                        .build(),
                observer);

        assertThat(((StatusRuntimeException) observer.error).getStatus().getCode())
                .isEqualTo(Status.INVALID_ARGUMENT.getCode());
    }

    @Test
    void updateInvoiceIsNotFoundForForeignOrMissingInvoices() {
        when(invoiceRepository.findById(7L))
                .thenReturn(
                        Optional.of(invoice(7L, "someone-else", "item", new BigDecimal("10.00"))));
        when(invoiceRepository.findById(8L)).thenReturn(Optional.empty());

        for (long id : Set.of(7L, 8L)) {
            RecordingObserver<UpdateInvoiceResponse> observer = new RecordingObserver<>();
            service.updateInvoice(
                    UpdateInvoiceRequest.newBuilder()
                            .setUserId(USER)
                            .setInvoiceId(id)
                            .setItemName("new item")
                            .build(),
                    observer);

            assertThat(((StatusRuntimeException) observer.error).getStatus().getCode())
                    .isEqualTo(Status.NOT_FOUND.getCode());
        }
    }

    @Test
    void createInvoiceIsAcceptedAndEmbeddedImmediately() {
        RecordingObserver<CreateInvoiceResponse> observer = new RecordingObserver<>();
        service.createInvoice(
                CreateInvoiceRequest.newBuilder()
                        .setUserId(USER)
                        .setItemName("Laptop")
                        .setCompany("Apple")
                        .setPrice("999.00")
                        .setCategory("ARBEITSMITTEL")
                        .setInvoiceDate("2025-06-01")
                        .build(),
                observer);

        assertThat(observer.value.getInvoice().getItemName()).isEqualTo("Laptop");
        assertThat(observer.value.getInvoice().getStatus()).isEqualTo("ACCEPTED");
        verify(embeddingService).embedInvoice(any(Invoice.class));
    }

    @Test
    void createInvoiceRejectsInvalidCategoryAndPrice() {
        RecordingObserver<CreateInvoiceResponse> categoryObserver = new RecordingObserver<>();
        service.createInvoice(
                CreateInvoiceRequest.newBuilder()
                        .setUserId(USER)
                        .setItemName("Laptop")
                        .setCompany("Apple")
                        .setPrice("999.00")
                        .setCategory("NOT_A_REAL_CATEGORY")
                        .build(),
                categoryObserver);
        assertThat(((StatusRuntimeException) categoryObserver.error).getStatus().getCode())
                .isEqualTo(Status.INVALID_ARGUMENT.getCode());

        RecordingObserver<CreateInvoiceResponse> priceObserver = new RecordingObserver<>();
        service.createInvoice(
                CreateInvoiceRequest.newBuilder()
                        .setUserId(USER)
                        .setItemName("Laptop")
                        .setCompany("Apple")
                        .setPrice("not-a-number")
                        .setCategory("ARBEITSMITTEL")
                        .build(),
                priceObserver);
        assertThat(((StatusRuntimeException) priceObserver.error).getStatus().getCode())
                .isEqualTo(Status.INVALID_ARGUMENT.getCode());
    }

    @Test
    void findPotentialDuplicatesFiltersByDateWhenGiven() {
        Invoice sameDate = invoice(1L, USER, "item", new BigDecimal("9.99"));
        sameDate.setInvoiceDate(LocalDate.of(2025, 6, 1));
        Invoice differentDate = invoice(2L, USER, "item", new BigDecimal("9.99"));
        differentDate.setInvoiceDate(LocalDate.of(2025, 6, 2));
        when(invoiceRepository.findByUserIdAndCompanyIgnoreCaseAndPrice(
                        USER, "Amazon", new BigDecimal("9.99")))
                .thenReturn(List.of(sameDate, differentDate));

        RecordingObserver<FindPotentialDuplicatesResponse> observer = new RecordingObserver<>();
        service.findPotentialDuplicates(
                FindPotentialDuplicatesRequest.newBuilder()
                        .setUserId(USER)
                        .setCompany("Amazon")
                        .setPrice("9.99")
                        .setInvoiceDate("2025-06-01")
                        .build(),
                observer);

        assertThat(observer.value.getInvoicesList())
                .extracting(com.lotofopps.backend.grpc.Invoice::getId)
                .containsExactly(1L);
    }

    private static Invoice invoice(long id, String userId, String itemName, BigDecimal price) {
        Invoice invoice = new Invoice(itemName, "Amazon", price);
        invoice.setUserId(userId);
        invoice.setCategory(InvoiceCategory.SONSTIGE_AUSGABEN);
        invoice.setStatus(InvoiceStatus.ACCEPTED);
        ReflectionTestUtils.setField(invoice, "id", id);
        return invoice;
    }

    private static Document document(long id, String userId) {
        Document document = new Document("receipt.pdf", "application/pdf", 1234L, "s3/receipt");
        document.setUserId(userId);
        ReflectionTestUtils.setField(document, "id", id);
        return document;
    }

    /** Smallest possible observer: remembers the single response or error. */
    private static final class RecordingObserver<T> implements StreamObserver<T> {
        private T value;
        private Throwable error;

        @Override
        public void onNext(T next) {
            value = next;
        }

        @Override
        public void onError(Throwable t) {
            error = t;
        }

        @Override
        public void onCompleted() {}
    }
}
