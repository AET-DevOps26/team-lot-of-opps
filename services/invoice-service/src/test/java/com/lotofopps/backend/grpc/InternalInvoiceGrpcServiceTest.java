package com.lotofopps.backend.grpc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
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
    private InternalInvoiceGrpcService service;

    @BeforeEach
    void setUp() {
        invoiceRepository = mock(InvoiceRepository.class);
        documentRepository = mock(DocumentRepository.class);
        documentStorageService = mock(DocumentStorageService.class);
        service =
                new InternalInvoiceGrpcService(
                        invoiceRepository, documentRepository, documentStorageService);
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
