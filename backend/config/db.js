const mongoose = require('mongoose');
const dns = require('dns');

// Force Google DNS for SRV resolution (fixes ISP DNS blocking MongoDB Atlas SRV records)
dns.setServers(['8.8.8.8', '8.8.4.4']);

let retryTimer = null;

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
    } catch (error) {
        console.warn(`MongoDB Connection Error: ${error.message}. Will retry every 10s...`);
        // Auto-retry connection every 10 seconds
        if (!retryTimer) {
            retryTimer = setInterval(async () => {
                try {
                    if (mongoose.connection.readyState === 0) {
                        console.log('Retrying MongoDB connection...');
                        await mongoose.connect(process.env.MONGO_URI, {
                            serverSelectionTimeoutMS: 5000,
                            socketTimeoutMS: 45000,
                        });
                        console.log('MongoDB reconnected successfully!');
                        clearInterval(retryTimer);
                        retryTimer = null;
                    }
                } catch (e) {
                    console.log(`MongoDB retry failed: ${e.message}`);
                }
            }, 10000);
        }
    }
};

module.exports = connectDB;
