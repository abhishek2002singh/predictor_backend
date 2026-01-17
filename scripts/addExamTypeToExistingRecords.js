/**
 * Migration script to add examType to existing user records
 * Run this once after deploying the new schema changes
 *
 * Usage: node scripts/addExamTypeToExistingRecords.js
 */

const mongoose = require('mongoose');
const UserData = require('../src/model/userData/user');
require('dotenv').config();

async function migrateExistingRecords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find all records without examType
    const recordsWithoutExamType = await UserData.find({ examType: { $exists: false } });

    console.log(`Found ${recordsWithoutExamType.length} records without examType`);

    if (recordsWithoutExamType.length === 0) {
      console.log('No records to migrate. Exiting...');
      process.exit(0);
    }

    // Ask user which exam type to assign to existing records
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question(
      'Which exam type should be assigned to existing records?\n' +
      'Options: JEE_MAINS, JEE_ADVANCED, CUET, NEET, MHT_CET, KCET, WBJEE, BITSAT\n' +
      'Enter exam type (default: JEE_MAINS): ',
      async (answer) => {
        const examType = answer.trim().toUpperCase() || 'JEE_MAINS';

        // Validate exam type
        const validExamTypes = ["JEE_MAINS", "JEE_ADVANCED", "CUET", "NEET", "MHT_CET", "KCET", "WBJEE", "BITSAT"];
        if (!validExamTypes.includes(examType)) {
          console.error(`Invalid exam type: ${examType}`);
          process.exit(1);
        }

        // Update all records
        const result = await UserData.updateMany(
          { examType: { $exists: false } },
          { $set: { examType: examType } }
        );

        console.log(`Updated ${result.modifiedCount} records with examType: ${examType}`);

        // Drop old unique indexes on emailId and mobileNumber
        try {
          await UserData.collection.dropIndex('emailId_1');
          console.log('Dropped old emailId unique index');
        } catch (err) {
          console.log('emailId index already removed or does not exist');
        }

        try {
          await UserData.collection.dropIndex('mobileNumber_1');
          console.log('Dropped old mobileNumber unique index');
        } catch (err) {
          console.log('mobileNumber index already removed or does not exist');
        }

        console.log('Migration completed successfully!');
        process.exit(0);
      }
    );

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateExistingRecords();
