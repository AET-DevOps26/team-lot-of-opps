import pdfplumber 
import pytesseract
from PIL import Image
import io

async def extract_text(file) -> str:
    contents = await file.read()
    raw_text = ""
    if file.content_type == "application/pdf":
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                content = page.extract_text()
                raw_text += content or ""
    elif file.content_type in ["image/jpeg", "image/png"]:
        image = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(image)
        raw_text = text
    else:
        raise ValueError(f"Unsupported file type: {file.content_type}")
    extracted = raw_text.strip()
    if not extracted or len(extracted) < 10:
        raise ValueError("Could not extract text - document may be low quality or blank")
    return raw_text
