# 🚗 VariantWise — Your Personalized Car Consultant

**VariantWise** is an AI-powered car recommendation platform that helps users discover the perfect car **variant** tailored to their needs. Leveraging advanced machine learning and real-world insights, it simplifies the complex car selection process into a few intuitive steps.

VariantWise enhances recommendations by combining technical specifications with real-life experience metrics such as comfort, material quality, throttle response, and brake performance. These features are scored on a scale of 1 to 5, manually curated in the initial project phase, with plans to automate or validate them in future iterations. Behind the scenes, VariantWise builds a custom preference profile for each user by analyzing their inputs through semantic embeddings and rule-based scoring mechanisms. This personalized vector is then matched against every variant in the database to shortlist the top 5 best-matching variants. User interaction is handled through an intelligent chatbot powered by Retrieval-Augmented Generation (RAG). The chatbot gathers user preferences and then retrieves relevant insights and variant data from a curated knowledge base and provides context-aware recommendations.

VariantWise simplifies what is traditionally a complex and overwhelming process into a smart, conversational, and deeply personalized experience — helping every user find not just the right car, but the right variant.

---

## 📁 Project Structure

This monorepo is divided into five main components:

| Folder      | Description                                                                |
| ----------- | -------------------------------------------------------------------------- |
| `backend/`  | Node.js (Express) backend for authentication, sessions, and proxying.      |
| `data/`     | Datastore for all the scraped raw specs, the final dataset and the reviews |
| `frontend/` | Next.js frontend providing a sleek and interactive user interface.         |
| `model/`    | Python (Flask) service for AI/ML-powered car recommendations and Q&A.      |
| `scraper/`  | Scraping the specs and reviews for all cars in car_models.json             |

---

## ⚙️ Prerequisites

Make sure the following are installed/configured:

- Node.js (v16 or later)
- npm or yarn
- Python (v3.8+)
- pip
- MySQL server
- AWS account with access to Amazon Bedrock (Mistral model) and appropriate IAM permissions

---

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Prakhar-4/VariantWise
cd VariantWise
```

---

### 2. Scraper Setup (`scraper/`)

```bash
cd scraper
```

#### To collect technical specs of all variants of the car models listed in `car_models.json`

```bash
python main.py
```

#### To collect expert reviews of all car models listed in `car_models.json`

```bash
python reviews.py
```

#### To merge all the technical specs scraped into `final_dataset.csv`

```bash
python merge_data.py
```

> Make sure the `car_models.json` file is present in the `/scraper` folder — it's used as the master list of car models to scrape.

#### Manual Scoring of Experience Features

After running `merge_specs.py`, you’ll need to manually score each car variant for some user experience features. These features go beyond the technical specifications, capturing the real-world feel of the car.

The following (or some similar) user experience features need to be scored on a scale of 1 to 5:

- Front seat comfort
- Rear seat comfort
- Under-thigh support
- Rear seat recline angle
- Gear lever feel
- Bump absorption capability
- Cabin noise insulation
- Suspension quality
- Body roll control
- Small item storage practicality
- Steering feedback
- Throttle response
- Clutch feel
- Brake responsiveness
- Material quality
- Instrument cluster readability
- Infotainment system responsiveness
- Sound system quality

These scores power the experience metrics used by the recommendation engine to deliver more human-centric suggestions.

---

### 2. Backend Setup (`backend/`)

```bash
cd ../backend
npm install
# or
yarn install
```

#### Create `.env` File

```dotenv
# MySQL Database
DB_HOST=your_mysql_host
DB_USERNAME=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=your_mysql_database_name
DB_PORT=your_database_port

# Session Secret
Secret_Key=your_strong_session_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Server Settings
PORT=3001
NODE_ENV=development
```

#### Database Setup

- Ensure your MySQL server is running.
- Create the database as specified in `.env`.
- Create necessary tables like `users` (based on `backend/models/user.js`).
- _Note: Migration scripts are not included._

#### Start Backend Server

```bash
npm start
# or
node index.js
```

Backend runs at: `http://localhost:3001`

---

### 3. Model Setup (`model/`)

```bash
cd ../model
pip install -r requirements.txt
```

#### Create `.env` File

```dotenv
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
```

> If using an IAM user, make sure they have Amazon Bedrock permissions.

#### Required Files

- Ensure `final_dataset.csv` exists in `data/`.
- Ensure `reviews/` directory exists in `data/`.

#### Start Flask Server

```bash
python app.py
```

Model server runs at: `http://localhost:5000`

---

### 4. Frontend Setup (`frontend/`)

```bash
cd ../frontend
npm install
# or
yarn install
```

#### Create `.env.local`

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_MODEL_URL=http://localhost:5000
```

#### Start Frontend Server

```bash
npm run dev
# or
yarn dev
```

Frontend runs at: `http://localhost:3000`

---

## 🌐 Access the Application

Once all servers are up and running, open your browser and visit:

```
http://localhost:3000
```

---

## 📬 Feedback & Contributions

We welcome feedback and contributions! Feel free to open issues or submit PRs to make VariantWise better.

---

## 🛡 License

This project is licensed under the [MIT License](LICENSE).
