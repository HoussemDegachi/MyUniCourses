import { Router } from 'express';
import { getCoursesJSON } from '../scrapper/courseData.js';
import { generateSchedule } from '../ai/generation.js';
import { getAllProfsRatings } from '../scrapper/ratings.js';

const router = Router();

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateBody(body) {
  if (!isObject(body)) return ['body must be a JSON object'];

  const errors = [];
  const { term, classes, prompt, weights, time, daysOff, includeWaitlist } = body;

  if (!Number.isInteger(term)) errors.push('term must be an integer');
  if (typeof includeWaitlist !== "boolean") errors.push('includeWaitlist must be a boolean');
  if (!Array.isArray(classes) || classes.length === 0) errors.push('classes must be a non-empty array');
  if (typeof prompt !== 'string') errors.push('prompt must be a string');

  if (!isObject(weights)) {
    errors.push('weights must be an object');
  } else {
    for (const key of ['profRating', 'classTime', 'fewerGaps']) {
      if (!Number.isInteger(weights[key])) errors.push(`weights.${key} must be an integer`);
    }
  }

  if (!isObject(time)) {
    errors.push('time must be an object');
  } else {
    for (const key of ['start', 'end']) {
      if (typeof time[key] !== 'string') errors.push(`time.${key} must be a string`);
    }
  }

  if (!Array.isArray(daysOff) || !daysOff.every((d) => typeof d === 'string')) {
    errors.push('daysOff must be an array of strings');
  }

  return errors;
}

router.post('/schedule', async (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid request body', details: errors });
  }

  const { term, classes, prompt, weights, time, daysOff, includeWaitlist } = req.body;

  try {
    const courseData = await getCoursesJSON(term, classes);
    // console.log("Course data retreived")
    const profRatings = await (getAllProfsRatings(courseData))
    // console.log("profRatings retereived")
    // console.log(profRatings)
    const schedule = await generateSchedule(courseData, profRatings, prompt, weights, time, daysOff, includeWaitlist );
    // console.log("done")

    // If generateSchedule returns a JSON string, parse it so we don't send a double-encoded string.
    // If the AI returns bad JSON, the parse throws and the catch sends a 500.
    res.json(typeof schedule === 'string' ? JSON.parse(schedule) : schedule);
  } catch (err) {
    console.error('Schedule generation failed:', err);
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

export default router;