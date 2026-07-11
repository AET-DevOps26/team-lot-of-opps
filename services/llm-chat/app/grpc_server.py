import logging

import grpc

from app.grpc_gen import embedding_pb2, embedding_pb2_grpc
from app.vector_store import store_embeddings, delete_embeddings

logger = logging.getLogger(__name__)

GRPC_PORT = 50051


class EmbeddingServicer(embedding_pb2_grpc.EmbeddingServiceServicer):
    async def Embed(self, request, context):
        await store_embeddings(
            request.invoice_id,
            request.text,
            request.user_id,
            item_name=request.item_name,
            company=request.company,
            price=request.price if request.HasField("price") else None,
            category=request.category if request.HasField("category") else None,
            invoice_date=request.invoice_date if request.HasField("invoice_date") else None,
            document_id=request.document_id if request.HasField("document_id") else None,
        )
        return embedding_pb2.Ack(status="ok")

    async def DeleteEmbedding(self, request, context):
        await delete_embeddings(request.invoice_id)
        return embedding_pb2.Ack(status="ok")


async def start_grpc_server(port: int = GRPC_PORT) -> grpc.aio.Server:
    server = grpc.aio.server()
    embedding_pb2_grpc.add_EmbeddingServiceServicer_to_server(EmbeddingServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    await server.start()
    logger.info("gRPC EmbeddingService listening on :%d", port)
    return server
