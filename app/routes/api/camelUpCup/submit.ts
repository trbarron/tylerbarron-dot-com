// POST /api/camelUpCup/submit — multipart form: botName, author, file (.py)
//
// Fast-fails obviously invalid bots, rate-limits by IP, adds the bot to the
// waiting list in Redis and emails Tyler, who runs tournaments by hand.
// Nothing submitted here is executed by the site.

import { randomUUID } from 'node:crypto';
import type { ActionFunctionArgs } from 'react-router';
import {
  validateAuthor,
  validateBotCode,
  validateBotName,
  MAX_BOT_FILE_BYTES,
} from '~/utils/camelUpCup/validation.server';
import { allowSubmission, enqueueSubmission, notifySubmission } from '~/utils/camelUpCup/tournament.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BOT_FILE_BYTES + 4096) {
    return Response.json({ error: 'Bot file is too large (max 64 KB).' }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const botName = form.get('botName');
    const author = form.get('author');
    const file = form.get('file');

    const nameError = validateBotName(botName);
    if (nameError) return Response.json({ error: nameError }, { status: 400 });

    const authorError = validateAuthor(author);
    if (authorError) return Response.json({ error: authorError }, { status: 400 });

    if (!(file instanceof File)) {
      return Response.json({ error: 'Attach your bot as a .py file.' }, { status: 400 });
    }
    const code = await file.text();
    const codeErrors = validateBotCode(code);
    if (codeErrors.length > 0) {
      return Response.json({ error: codeErrors.join(' ') }, { status: 400 });
    }

    if (!(await allowSubmission(request))) {
      return Response.json(
        { error: 'Too many submissions from your address — try again in an hour.' },
        { status: 429 },
      );
    }

    const submission = {
      id: `sub-${randomUUID()}`,
      botName: botName as string,
      author: (author as string).trim(),
      code,
      submitted: new Date().toISOString(),
    };

    const waiting = await enqueueSubmission(submission);
    if (waiting === null) {
      return Response.json(
        { error: 'The waiting list is full right now. Try again after the next tournament.' },
        { status: 429 },
      );
    }

    // The bot is safely queued either way; the email is only the nudge.
    await notifySubmission(submission, waiting);

    return Response.json({ id: submission.id, botName: submission.botName, waiting });
  } catch (error) {
    console.error('Camel Up Cup submit error:', error);
    return Response.json({ error: 'Failed to submit bot.' }, { status: 500 });
  }
}
