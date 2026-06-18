# Nova Biz — Deployment Guide

## Local Development
```bash
npm install
npm start
# Server runs at http://localhost:8080
```

## Vercel Deployment

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Click "Deploy"

### Step 3: Set Environment Variables
After deployment, go to **Settings** → **Environment Variables** and add:
```
MONGODB_URI=mongodb+srv://ainomjonov668_db_user:cw3ZZdWEGhD9N33H@cluster0.xhlcu6r.mongodb.net/yangi_diyor?retryWrites=true&w=majority
MONGODB_DB=yangi_diyor
```

### Step 4: Redeploy
Click "Deployments" → click the latest deployment → click "Redeploy"

Your app is now live! 🚀

## What's Included
- ✅ Vercel serverless API at `/api/*`
- ✅ Static files (index.html, style.css, app.js)
- ✅ MongoDB Atlas connection
- ✅ Local fallback to data.json
- ✅ Port configuration (8080 locally, automatic on Vercel)

## Login
- Password: `1234`
- Username: optional

## Notes
- Data persists in MongoDB Atlas
- No data loss on Vercel redeploys
- Free tier of Vercel works fine
