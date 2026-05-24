import fitz
import base64

def pdf_to_base64_images(pdf_bytes: bytes) -> list[str]:
    invoice = fitz.open(stream=pdf_bytes,filetype="pdf")
    images = []
    for page in invoice:
        png_bytes = page.get_pixmap(dpi=150).tobytes("png")
        images.append(base64.b64encode(png_bytes).decode())
    return images