
import { db } from './firebase';

interface LogData {
    action: string;
    performedBy: { uid: string; email: string; };
    targetUser?: { uid: string; email: string; };
    details: string;
}

/**
 * Adds a new log entry to the 'activityLogs' collection in Firestore.
 * @param logData - The data for the log entry.
 */
export const addLog = async (logData: LogData): Promise<void> => {
    try {
        await db.collection('activityLogs').add({
            ...logData,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error writing to activity log:", error);
        // In a real application, you might want to send this error to a monitoring service.
    }
};
