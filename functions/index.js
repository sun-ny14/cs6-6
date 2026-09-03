'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueWritten } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { randomInt } = require('node:crypto');
const core = require('./checkin-password-core');
initializeApp({ databaseURL: 'https://cs6-6class-default-rtdb.firebaseio.com' });

// Runs even when every classroom browser is closed.
exports.rotateDailyCheckinPassword = onSchedule({
    schedule: '0 0 * * *', timeZone: 'Asia/Seoul', region: 'us-central1',
    retryCount: 3, minBackoffSeconds: 30, maxInstances: 1, timeoutSeconds: 60
}, async () => {
    const database = getDatabase();
    const settings = await core.ensureCurrent(database, Date.now, randomInt);
    await core.publish(database, settings);
});

// Manual changes and automatic rotations use the same public display record.
exports.syncCheckinPasswordDisplay = onValueWritten({
    ref: '/settings/password', instance: 'cs6-6class-default-rtdb', region: 'us-central1',
    retry: true, maxInstances: 1, timeoutSeconds: 60
}, async event => {
    if (event.data.before.val() === event.data.after.val()) return;
    const database = getDatabase();
    const snapshot = await database.ref('settings').once('value');
    await core.publish(database, snapshot.val());
});
