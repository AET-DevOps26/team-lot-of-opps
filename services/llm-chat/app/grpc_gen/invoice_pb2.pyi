from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GetLatestInvoicesRequest(_message.Message):
    __slots__ = ("user_id", "limit", "invoice_year")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    INVOICE_YEAR_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    limit: int
    invoice_year: int
    def __init__(self, user_id: _Optional[str] = ..., limit: _Optional[int] = ..., invoice_year: _Optional[int] = ...) -> None: ...

class GetLatestInvoicesResponse(_message.Message):
    __slots__ = ("invoices",)
    INVOICES_FIELD_NUMBER: _ClassVar[int]
    invoices: _containers.RepeatedCompositeFieldContainer[Invoice]
    def __init__(self, invoices: _Optional[_Iterable[_Union[Invoice, _Mapping]]] = ...) -> None: ...

class Invoice(_message.Message):
    __slots__ = ("id", "item_name", "company", "price", "category", "user_id", "invoice_date", "created_at", "document_id", "status")
    ID_FIELD_NUMBER: _ClassVar[int]
    ITEM_NAME_FIELD_NUMBER: _ClassVar[int]
    COMPANY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    INVOICE_DATE_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    DOCUMENT_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    id: int
    item_name: str
    company: str
    price: str
    category: str
    user_id: str
    invoice_date: str
    created_at: str
    document_id: int
    status: str
    def __init__(self, id: _Optional[int] = ..., item_name: _Optional[str] = ..., company: _Optional[str] = ..., price: _Optional[str] = ..., category: _Optional[str] = ..., user_id: _Optional[str] = ..., invoice_date: _Optional[str] = ..., created_at: _Optional[str] = ..., document_id: _Optional[int] = ..., status: _Optional[str] = ...) -> None: ...

class GetDocumentsRequest(_message.Message):
    __slots__ = ("user_id", "document_ids")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DOCUMENT_IDS_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    document_ids: _containers.RepeatedScalarFieldContainer[int]
    def __init__(self, user_id: _Optional[str] = ..., document_ids: _Optional[_Iterable[int]] = ...) -> None: ...

class GetDocumentsResponse(_message.Message):
    __slots__ = ("documents",)
    DOCUMENTS_FIELD_NUMBER: _ClassVar[int]
    documents: _containers.RepeatedCompositeFieldContainer[Document]
    def __init__(self, documents: _Optional[_Iterable[_Union[Document, _Mapping]]] = ...) -> None: ...

class Document(_message.Message):
    __slots__ = ("id", "filename", "content_type", "size_bytes", "uploaded_at", "user_id")
    ID_FIELD_NUMBER: _ClassVar[int]
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    UPLOADED_AT_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    id: int
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str
    user_id: str
    def __init__(self, id: _Optional[int] = ..., filename: _Optional[str] = ..., content_type: _Optional[str] = ..., size_bytes: _Optional[int] = ..., uploaded_at: _Optional[str] = ..., user_id: _Optional[str] = ...) -> None: ...

class GetDocumentContentRequest(_message.Message):
    __slots__ = ("user_id", "document_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DOCUMENT_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    document_id: int
    def __init__(self, user_id: _Optional[str] = ..., document_id: _Optional[int] = ...) -> None: ...

class GetDocumentContentResponse(_message.Message):
    __slots__ = ("content",)
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    content: bytes
    def __init__(self, content: _Optional[bytes] = ...) -> None: ...
