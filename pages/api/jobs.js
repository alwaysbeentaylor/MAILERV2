// API Endpoint: Jobs Management
// Lists, creates, updates, and deletes email sending jobs

import { getJobs, getJob, createJob, updateJob, deleteJob, getJobStats } from '../../utils/job-store';

export default async function handler(req, res) {
    // GET - List jobs or get single job
    if (req.method === 'GET') {
        try {
            const { id, status, limit, offset, stats } = req.query;

            // Get stats
            if (stats === 'true') {
                const jobStats = await getJobStats();

                // Get database stats for accurate total count (includes single sends)
                try {
                    const { getStats: getDbStats } = require('../../utils/database');
                    const dbStats = await getDbStats();

                    // Merge stats: prefer database total for emailsSent
                    if (dbStats && dbStats.summary) {
                        jobStats.emailsSent = dbStats.summary.totalEmails || jobStats.emailsSent;
                        // Also include click/reply rates if available
                        jobStats.clickRate = dbStats.summary.clickRate;
                        jobStats.replyRate = dbStats.summary.replyRate;
                    }
                } catch (e) {
                    console.error('Error fetching DB stats:', e);
                }

                return res.status(200).json({ success: true, stats: jobStats });
            }

            // Get single job
            if (id) {
                const job = await getJob(id);
                if (!job) {
                    return res.status(404).json({ success: false, error: 'Job niet gevonden' });
                }
                return res.status(200).json({ success: true, job });
            }

            // List jobs
            const result = await getJobs({
                status,
                limit: parseInt(limit) || 100,
                offset: parseInt(offset) || 0
            });

            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST - Create new job
    if (req.method === 'POST') {
        try {
            const jobData = req.body;
            const job = await createJob(jobData);
            return res.status(201).json({ success: true, job });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // PUT - Update job
    if (req.method === 'PUT') {
        try {
            const { id, ...updates } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, error: 'Job ID is verplicht' });
            }

            const job = await updateJob(id, updates);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Job niet gevonden' });
            }

            return res.status(200).json({ success: true, job });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // DELETE - Delete job
    if (req.method === 'DELETE') {
        try {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, error: 'Job ID is verplicht' });
            }

            await deleteJob(id);
            return res.status(200).json({ success: true, message: 'Job verwijderd' });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
