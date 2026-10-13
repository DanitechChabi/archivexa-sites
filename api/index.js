// Single entry point for the whole API (the Vercel Hobby plan allows 12 functions).
// vercel.json rewrites /api/<route> to /api?__r=<route>; handlers live in api/_r/.
import subscribe from './_r/subscribe.js';
import unsubscribe from './_r/unsubscribe.js';
import requests from './_r/requests.js';
import posts from './_r/posts.js';
import adminLogin from './_r/admin/login.js';
import adminData from './_r/admin/data.js';
import adminPosts from './_r/admin/posts.js';
import adminSubscribers from './_r/admin/subscribers.js';
import liveSessions from './_r/live/sessions.js';
import liveToken from './_r/live/token.js';
import liveAdmin from './_r/live/admin.js';
import liveAttendance from './_r/live/attendance.js';
import liveCertificate from './_r/live/certificate.js';
import jobs from './_r/jobs.js';
import talents from './_r/talents.js';
import adminTalents from './_r/admin/talents.js';
import adminJobs from './_r/admin/jobs.js';
import { send } from './_r/_lib/http.js';

const ROUTES = {
  'subscribe': subscribe,
  'unsubscribe': unsubscribe,
  'requests': requests,
  'posts': posts,
  'admin/login': adminLogin,
  'admin/data': adminData,
  'admin/posts': adminPosts,
  'admin/subscribers': adminSubscribers,
  'live/sessions': liveSessions,
  'live/token': liveToken,
  'live/admin': liveAdmin,
  'live/attendance': liveAttendance,
  'live/certificate': liveCertificate,
  'jobs': jobs,
  'talents': talents,
  'admin/talents': adminTalents,
  'admin/jobs': adminJobs,
};

export default async function handler(req, res) {
  const query = req.query || {};
  let route = String(query.__r || '');
  if (!route) route = new URL(req.url || '/', 'http://x').pathname.replace(/^\/api\/?/, '');
  route = route.replace(/^\/+|\/+$/g, '').replace(/\.js$/, '');
  delete query.__r;
  req.query = query;
  const fn = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
  if (!fn) return send(res, 404, { error: 'not_found' });
  return fn(req, res);
}
