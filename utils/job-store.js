// Job Store Utility
// Stores and retrieves email sending job history

// In-memory store for development
let memoryJobStore = [];

async function getKV() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    try {
        const { kv } = await import('@vercel/kv');
        await kv.ping();
        return kv;
    } catch (e) {
        return null;
    }
}

const KV_KEY = 'email_jobs';

/**
 * Get all jobs (with optional filters)
 */
export async function getJobs(options = {}) {
    const { status, limit = 100, offset = 0 } = options;

    const kv = await getKV();
    let jobs = [];

    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
    } else {
        jobs = [...memoryJobStore];
    }

    // Sort by date descending (newest first)
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Filter by status if provided
    if (status) {
        jobs = jobs.filter(j => j.status === status);
    }

    // Paginate
    const total = jobs.length;
    jobs = jobs.slice(offset, offset + limit);

    return { jobs, total };
}

/**
 * Get a single job by ID
 */
export async function getJob(jobId) {
    const kv = await getKV();
    let jobs = [];

    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
    } else {
        jobs = memoryJobStore;
    }

    return jobs.find(j => j.id === jobId) || null;
}

/**
 * Create a new job
 */
export async function createJob(jobData) {
    const kv = await getKV();

    const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending', // pending, processing, completed, failed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...jobData,
        logs: [],
        results: null
    };

    let jobs = [];
    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
        jobs.push(job);
        await kv.set(KV_KEY, jobs);
    } else {
        memoryJobStore.push(job);
    }

    return job;
}

/**
 * Update a job
 */
export async function updateJob(jobId, updates) {
    const kv = await getKV();

    let jobs = [];
    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
    } else {
        jobs = memoryJobStore;
    }

    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    jobs[index] = {
        ...jobs[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    if (kv) {
        await kv.set(KV_KEY, jobs);
    }

    return jobs[index];
}

/**
 * Add log entry to a job
 */
export async function addJobLog(jobId, log) {
    const kv = await getKV();

    let jobs = [];
    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
    } else {
        jobs = memoryJobStore;
    }

    const index = jobs.findIndex(j => j.id === jobId);
    if (index === -1) return null;

    jobs[index].logs.push({
        timestamp: new Date().toISOString(),
        ...log
    });
    jobs[index].updatedAt = new Date().toISOString();

    if (kv) {
        await kv.set(KV_KEY, jobs);
    }

    return jobs[index];
}

/**
 * Delete a job
 */
export async function deleteJob(jobId) {
    const kv = await getKV();

    let jobs = [];
    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
        jobs = jobs.filter(j => j.id !== jobId);
        await kv.set(KV_KEY, jobs);
    } else {
        memoryJobStore = memoryJobStore.filter(j => j.id !== jobId);
    }

    return { success: true };
}

/**
 * Get job statistics
 */
export async function getJobStats() {
    const kv = await getKV();
    let jobs = [];

    if (kv) {
        jobs = await kv.get(KV_KEY) || [];
    } else {
        jobs = memoryJobStore;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayJobs = jobs.filter(j => j.createdAt.startsWith(today));

    return {
        total: jobs.length,
        today: todayJobs.length,
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        emailsSent: jobs.reduce((sum, j) => sum + (j.results?.sent || 0), 0),
        emailsFailed: jobs.reduce((sum, j) => sum + (j.results?.failed || 0), 0)
    };
}
