import fitz
import base64

def pdf_to_base64_images(pdf_bytes: bytes) -> list[tuple[str, str]]:
    invoice = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in invoice:
        png_bytes = page.get_pixmap(dpi=96).tobytes("png")
        images.append(("image/png", base64.b64encode(png_bytes).decode()))
    return images

def image_to_base64(image_bytes: bytes, content_type: str) -> list[tuple[str, str]]:
    mime = content_type if content_type in ("image/jpeg", "image/png") else "image/png"
    return [(mime, base64.b64encode(image_bytes).decode())]