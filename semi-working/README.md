# Zero Waste Bin Monitoring System

A full-stack web application for trash sorting and bin monitoring, optimized for mobile devices and integrated with UCLA Facilities Management.

## Tech Stack

- **Frontend**: React 18, Vite, CSS Modules
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Integration**: Ready for Hugging Face integration (Python)
- **Development Tools**: GitHub, Claude/Gemini/ChatGPT for AI assistance

## Features

### Student View
- **Smart Item Sorting**: Camera-based item detection with AI segmentation
- **Bin Fullness Reporting**: Real-time bin status reporting
- **Nearby Bins**: GPS-based bin discovery with live status
- **Personal Impact Tracking**: Track environmental impact

### Admin View
- **Real-time Dashboard**: Live statistics calculated from actual data
- **Problem Bin Detection**: Automatic identification of problematic bins
- **Visual Analytics**: Maps and trend analysis
- **Detailed Investigation**: Drill-down into specific bin performance

### UCLA Facilities Integration
- **Automated Data Sync**: Import bin locations from facilities management
- **Contamination Tracking**: Sync contamination reports
- **Facility Reports**: Generate reports for UCLA management
- **GPS Integration**: Location-based bin discovery

## Project Structure

```
├── src/                    # Frontend React application
│   ├── App.jsx            # Main React component
│   ├── api.js             # API wrapper
│   ├── main.jsx           # React entry point
│   └── styles.css         # Mobile-first styles
├── server/                # Backend Node.js application
│   ├── models/            # MongoDB/Mongoose models
│   │   ├── Station.js
│   │   ├── Bin.js        # Enhanced with GPS and facilities data
│   │   ├── OverviewStat.js
│   │   ├── ProblemBin.js
│   │   ├── FullnessReport.js
│   │   └── StudentImpact.js
│   ├── services/          # Business logic
│   │   └── facilitiesIntegration.js  # UCLA facilities sync
│   ├── server.js          # Express server with API routes
│   ├── importFacilityData.js  # CLI tool for data import
│   ├── ucla_bins_sample.json  # Sample facility data
│   ├── package.json       
│   └── .env.example       
├── index.html             
├── package.json           
├── vite.config.js         
└── README.md             
```

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd zero-waste-bin-system
```

### 2. Setup Backend

#### Configure MongoDB
```bash
cd server
cp .env.example .env
```

Edit `.env` and add your MongoDB connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/zero-waste-bin
PORT=5000
```

#### Install Dependencies & Start Server
```bash
npm install
npm start
```

The server will:
1. Connect to MongoDB
2. Initialize database with minimal setup
3. Start calculating real-time statistics
4. Begin listening on port 5000

### 3. Setup Frontend

In a new terminal:
```bash
# From project root
npm install
npm run dev
```

The app will open at http://localhost:3000

## UCLA Facilities Integration

### Importing Bin Location Data

Use the provided import script to load bin data from UCLA Facilities:

```bash
cd server
node importFacilityData.js ucla_bins_sample.json
```

Expected JSON format:
```json
{
  "bins": [
    {
      "facilityId": "UCLA-BIN-001",
      "name": "Ackerman Union — Food Court",
      "building": "Ackerman Union",
      "floor": "Level 1",
      "latitude": 34.070266,
      "longitude": -118.444183,
      "streams": ["compost", "recycle", "landfill"],
      "capacity": 50,
      "type": "standard"
    }
  ]
}
```

### API Endpoints for Facilities

#### Update Bin Locations
```bash
POST /api/facilities/update-bins
Content-Type: application/json

{
  "bins": [...]
}
```

#### Sync Contamination Data
```bash
POST /api/facilities/sync-contamination
Content-Type: application/json

{
  "contaminationData": [
    {
      "facilityId": "UCLA-BIN-001",
      "contaminationRate": 8.5
    }
  ]
}
```

#### Get Facility Report
```bash
GET /api/facilities/report?startDate=2024-01-01&endDate=2024-01-31
```

## API Reference

### Public Endpoints
- `GET /api/health` - System health check
- `GET /api/station/current` - Current station info
- `GET /api/bins/nearby` - Nearby bins with GPS distance
- `GET /api/bins/:id/stats` - Real-time bin statistics

### Student Actions
- `POST /api/segment` - AI segmentation (mock data currently)
- `POST /api/bins/report-fullness` - Report bin status
- `POST /api/student/impact` - Update environmental impact

### Admin Endpoints
- `GET /api/admin/overview` - Real-time dashboard stats
- `GET /api/admin/problem-bins` - Bins requiring attention

### Facilities Management
- `POST /api/facilities/update-bins` - Bulk update bin locations
- `POST /api/facilities/sync-contamination` - Update contamination data
- `GET /api/facilities/report` - Generate management reports

## Real-time Features

The system now provides:
- **Live Statistics**: Calculated from actual database records
- **Automatic Updates**: Stats refresh every 5 minutes
- **Dynamic Problem Detection**: Based on fullness and contamination thresholds
- **GPS-based Discovery**: Find bins based on actual coordinates

## Development

### Running in Development
```bash
# Backend with auto-reload
cd server && npm run dev

# Frontend with hot-reload
npm run dev
```

### Adding Real AI Integration

To integrate actual AI segmentation:

1. Create Python service:
```python
# server/services/segmentation.py
from transformers import pipeline
# Your Hugging Face model here
```

2. Update `/api/segment` endpoint to call Python service

### Database Management

The system now uses real data:
- Statistics are calculated from actual reports
- Problem bins are identified automatically
- No more placeholder data needed

To reset the database:
```bash
# In MongoDB shell or Atlas
use zero-waste-bin
db.dropDatabase()
```

## Production Deployment

1. Set environment variables:
   - `MONGODB_URI` - Production database
   - `NODE_ENV=production`
   - `PORT` - Server port

2. Build frontend:
```bash
npm run build
```

3. Deploy to your hosting service (Heroku, AWS, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For UCLA Facilities Management integration support, contact your facilities coordinator.
For technical issues, open a GitHub issue.