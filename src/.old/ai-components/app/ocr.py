import pdfplumber 
import pytesseract
from PIL import Image
import io
#vision AI?
#2 step pipeline?
#google ai vision

async def extract_text(file) -> str:
    contents = await file.read()
    raw_text = ""
    filename = (file.filename or "").lower()
    content_type = file.content_type or ""
    is_pdf = content_type == "application/pdf" or filename.endswith(".pdf")
    is_image = content_type in ["image/jpeg", "image/png"] or filename.endswith((".jpg", ".jpeg", ".png"))
    if is_pdf:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                content = page.extract_text()
                raw_text += content or ""
    elif is_image:
        image = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(image)
        raw_text = text
    else:
        raise ValueError(f"Unsupported file type: {file.content_type}")
    extracted = raw_text.strip()
    if not extracted or len(extracted) < 10:
        raise ValueError("Could not extract text - document may be low quality or blank")
    return raw_text
