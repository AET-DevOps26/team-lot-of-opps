from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class EmbedRequest(_message.Message):
    __slots__ = ("invoice_id", "text", "user_id", "item_name", "company", "price", "category", "invoice_date", "document_id")
    INVOICE_ID_FIELD_NUMBER: _ClassVar[int]
    TEXT_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ITEM_NAME_FIELD_NUMBER: _ClassVar[int]
    COMPANY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    INVOICE_DATE_FIELD_NUMBER: _ClassVar[int]
    DOCUMENT_ID_FIELD_NUMBER: _ClassVar[int]
    invoice_id: int
    text: str
    user_id: str
    item_name: str
    company: str
    price: float
    category: str
    invoice_date: str
    document_id: int
    def __init__(self, invoice_id: _Optional[int] = ..., text: _Optional[str] = ..., user_id: _Optional[str] = ..., item_name: _Optional[str] = ..., company: _Optional[str] = ..., price: _Optional[float] = ..., category: _Optional[str] = ..., invoice_date: _Optional[str] = ..., document_id: _Optional[int] = ...) -> None: ...

class DeleteRequest(_message.Message):
    __slots__ = ("invoice_id",)
    INVOICE_ID_FIELD_NUMBER: _ClassVar[int]
    invoice_id: int
    def __init__(self, invoice_id: _Optional[int] = ...) -> None: ...

class Ack(_message.Message):
    __slots__ = ("status",)
    STATUS_FIELD_NUMBER: _ClassVar[int]
    status: str
    def __init__(self, status: _Optional[str] = ...) -> None: ...
