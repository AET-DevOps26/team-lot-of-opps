import os
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

project_id = os.environ['FIREBASE_PROJECT_ID']
emulator_host = os.environ.get('FIREBASE_AUTH_EMULATOR_HOST')

if emulator_host:
    app_fb = firebase_admin.initialize_app(options={'projectId': project_id})
else:
    cred = credentials.Certificate(os.environ['GOOGLE_APPLICATION_CREDENTIALS'])
    app_fb = firebase_admin.initialize_app(cred, options={'projectId': project_id})

app = FastAPI()


@app.get("/verify")
async def verify(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"error": "Missing or invalid Authorization header"})
    token = auth_header.removeprefix("Bearer ")
    try:
        decoded = firebase_auth.verify_id_token(token, app=app_fb)
        return JSONResponse(
            status_code=200,
            headers={"X-User-Sub": decoded["uid"]},
            content={},
        )
    except Exception as e:
        return JSONResponse(status_code=401, content={"error": str(e)})


@app.get("/health")
async def health():
    return {"status": "ok"}
