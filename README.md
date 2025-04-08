# Family Tree Application

A self-hosted family tree management application that allows you to maintain your family information privately without relying on third-party services that might compromise your data privacy.

## Overview

This Family Tree application was created out of concern for the privacy of family information. While many existing applications and websites offer similar functionality, they require entrusting your personal family data to third parties. This project enables you to host and manage your family information privately, eliminating concerns about data leaks or unauthorized access.

## Features

- **Family Member Management**
  - Add new family members
  - Edit existing information
  - Delete family members
  - Upload and manage photos
  - Visualize relationships between individuals

## Technology Stack

### Frontend
- HTML
- CSS
- JavaScript
- jQuery
- FamilyTree.js (for tree visualization)

### Backend
- Node.js
- Express.js

### Database
- MySQL with Sequelize ORM

### Additional Tools
- Multer (for file handling)
- CORS
- Path
- File System modules

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Zachry2906/family-tree.git
   ```

2. Navigate to the project directory:
   ```bash
   cd family-tree
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Configure the database in `config/db.js`:
   ```javascript
   const db = new Sequelize("js", "root", "", {
       host: "localhost",
       dialect: "mysql",
   });
   ```

5. Create a MySQL database named "js" (or modify the configuration to match your preferred database name)

## Usage

1. Start the application:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/view
   ```

## Project Structure

```
famtree/
├── config/               # Database configuration
│   └── db.js
├── controllers/          # API Controllers
│   └── FamillyController.js
├── model/                # Database models
│   ├── Association.js    # Relationships between models
│   ├── index.js
│   ├── Person.js
│   └── Relationship.js
├── routes/               # API route definitions
│   └── famillyRoutes.js
├── view/                 # Frontend
│   ├── assets/           # Photo storage location
│   ├── index.html
│   └── script.js
├── index.js              # Application entry point
├── package.json
└── README.md
```

## Project Status

The project is still under development with some unresolved bugs. Contributions to improve and complete the application are highly appreciated.

## How to Contribute

Contributions to improve this application are warmly welcomed. Follow these steps to contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature-branch`)
6. Open a Pull Request

## License

This project is currently unlicensed. A license will be added in future updates.

## Contact

If you have any questions or suggestions, please open an issue on GitHub.

---

**Note:** This application prioritizes your data privacy by allowing complete control over your family information.
