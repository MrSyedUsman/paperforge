# Deploying PaperForge to Google Cloud Run

Pushing to `main` runs `.github/workflows/deploy.yml`: it builds both Docker images, pushes them to
Artifact Registry, deploys `paperforge-backend`, then `paperforge-frontend` (built against the backend URL),
and finally sets the backend's CORS origin to the frontend URL.

## One-time Google Cloud setup (replace the values in CAPS)

```bash
PROJECT_ID=your-project-id
REGION=us-central1
GITHUB_REPO=MrSyedUsman/paperforge
gcloud config set project $PROJECT_ID

gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com

gcloud artifacts repositories create paperforge --repository-format=docker --location=$REGION

gcloud iam service-accounts create github-deployer
SA=github-deployer@$PROJECT_ID.iam.gserviceaccount.com
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=$role
done

gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github-repo --location=global \
  --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"

PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding $SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-repo"
```

## GitHub repository secrets (Settings > Secrets and variables > Actions)

| Secret | Value |
| --- | --- |
| `GCP_PROJECT_ID` | your Google Cloud project id |
| `GCP_REGION` | e.g. `us-central1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | the `projects/.../providers/github-repo` line printed above |
| `GCP_SERVICE_ACCOUNT` | `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` | Firebase web config for Firestore |
| `JWT_SECRET` | long random string (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Gemini API key, passed to the backend as an environment variable |
| `SEED_USERNAME`, `SEED_PASSWORD`, `SEED_DISPLAY_NAME` | initial account created in Firestore on first start |

## Notes
- Firestore test-mode rules expire after 30 days; update them before then.
- If Cloud Run has CPU throttling on, the backend's first request after idle can be slow (Firestore reconnects).
