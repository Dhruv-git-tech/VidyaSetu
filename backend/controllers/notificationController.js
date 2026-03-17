const Notification = require('../models/Notification');

// @desc    Get notifications for a user (filtered by role and class)
const getNotifications = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([]);
    }
    try {
        const { role, userId, standard } = req.query;
        const filter = {};
        // Show notifications targeted to 'all' or the user's specific role
        if (role) {
            filter.$or = [{ targetRole: 'all' }, { targetRole: role + 's' }];
        }
        // Filter by class/standard if provided
        if (standard) {
            filter.$or = (filter.$or || []).concat([
                { standard: 'ALL' },
                { standard: standard }
            ]);
        }
        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(50);

        // Add a `read` flag for this user
        const result = notifications.map(n => ({
            ...n.toObject(),
            read: userId ? n.readBy.some(id => id.toString() === userId) : false,
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Mark a notification as read
const markAsRead = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: true });
    }
    try {
        const { userId } = req.body;
        await Notification.findByIdAndUpdate(req.params.id, {
            $addToSet: { readBy: userId },
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Mark all notifications as read for a user
const markAllAsRead = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: true });
    }
    try {
        const { userId } = req.body;
        await Notification.updateMany(
            { readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Create a notification (internal use — called from other controllers)
const createNotification = async ({ title, message, type, referenceId, createdBy, createdByName, targetRole, standard, section }) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return null;
    try {
        const notification = await Notification.create({
            title, message, type,
            referenceId: referenceId || null,
            createdBy, createdByName,
            targetRole: targetRole || 'all',
            standard: standard || 'ALL',
            section: section || 'ALL',
        });
        return notification;
    } catch (error) {
        console.error('Notification creation error:', error.message);
        return null;
    }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, createNotification };
