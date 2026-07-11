from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GetLatestInvoicesRequest(_message.Message):
    __slots__ = ("user_id", "limit")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    limit: int
    def __init__(self, user_id: _Optional[str] = ..., limit: _Optional[int] = ...) -> None: ...

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
