import { EMOTES } from '@shadow-court/protocol';
import { useEffect, useRef, useState } from 'react';
import { nameIn } from '../controller';
import { copyText, inviteLink } from '../clipboard';
import { useApp, useController, useT } from '../hooks';
import { LANGS } from '../i18n';
import { describeEvent } from '../logic/describe';
import { unlockAudio } from '../sound';

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Title, room code, language, sound and leave. Shown on every screen. */
export function TopBar() {
  const t = useT();
  const app = useController();
  const lang = useApp((s) => s.lang);
  const sound = useApp((s) => s.sound);
  const joined = useApp((s) => s.joined);
  const [sure, setSure] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sure) return;
    const id = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(id);
  }, [sure]);

  return (
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 64 64" className="brand-mark" aria-hidden="true" focusable="false">
          <path d="M12 44 L16 22 L26 32 L32 16 L38 32 L48 22 L52 44 Z" />
          <rect x="12" y="46" width="40" height="6" rx="2" />
        </svg>
        <span className="brand-name">{t('app.title')}</span>
      </div>
      <div className="topbar-right">
        {joined && (
          <button
            type="button"
            className="chip chip-code"
            title={t('lobby.copyLink')}
            onClick={async () => {
              setCopied(await copyText(inviteLink(joined.code)));
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t('lobby.copied') : joined.code}
          </button>
        )}
        <div className="seg" role="group" aria-label={t('top.language')}>
          {LANGS.map((l) => (
            <button key={l} type="button" className={`seg-btn${lang === l ? ' on' : ''}`} onClick={() => app.setLang(l)} aria-pressed={lang === l}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`chip chip-icon${sound ? ' on' : ''}`}
          aria-pressed={sound}
          title={sound ? t('top.soundOn') : t('top.soundOff')}
          onClick={() => {
            if (!sound) unlockAudio();
            app.setSound(!sound);
          }}
        >
          ♪
        </button>
        {joined && (
          <button
            type="button"
            className={`chip chip-leave${sure ? ' sure' : ''}`}
            onClick={() => (sure ? app.leaveRoom() : setSure(true))}
          >
            {sure ? t('top.leaveSure') : t('top.leave')}
          </button>
        )}
      </div>
    </header>
  );
}

const ERRORS_WITH_TEXT = new Set([
  'room_not_found', 'nickname_taken', 'room_full', 'spectators_full', 'spectators_disabled', 'bad_token', 'not_host',
  'not_enough_players', 'rate_limited', 'not_allowed', 'wrong_status', 'already_in_room', 'invalid_payload',
  'stale_window', 'not_your_turn', 'illegal_action', 'invalid_target', 'invalid_choice', 'not_eligible', 'already_responded',
]);

export function Toasts() {
  const t = useT();
  const app = useController();
  const toast = useApp((s) => s.toast);
  const conn = useApp((s) => s.conn);
  const closed = useApp((s) => s.closed);
  return (
    <div className="toasts" aria-live="assertive">
      {conn === 'offline' && <div className="toast toast-warn">{t('conn.offline')}</div>}
      {closed && (
        <button type="button" className="toast toast-warn" onClick={() => app.dismissClosed()}>
          {t(`closed.${closed}`)}
        </button>
      )}
      {toast && (
        <button type="button" className="toast toast-error" onClick={() => app.dismissToast()}>
          {ERRORS_WITH_TEXT.has(toast.code) ? t(`err.${toast.code}`) : toast.message}
        </button>
      )}
    </div>
  );
}

/** Shrinking bar with the seconds left in the current window. */
export function TimerBar() {
  const t = useT();
  const deadlineAt = useApp((s) => s.deadlineAt);
  const now = useNow(200);
  const seen = useRef({ deadline: 0, total: 1 });
  if (deadlineAt === null) return null;
  if (seen.current.deadline !== deadlineAt) seen.current = { deadline: deadlineAt, total: Math.max(1, deadlineAt - Date.now()) };
  const left = Math.max(0, deadlineAt - now);
  const percent = Math.min(100, (left / seen.current.total) * 100);
  const urgent = left < 5000;
  return (
    <div className={`timer${urgent ? ' urgent' : ''}`} role="timer" aria-label={t('timer.label')}>
      <div className="timer-bar" style={{ width: `${percent}%` }} />
      <span className="timer-text">{t('timer.seconds', { count: Math.ceil(left / 1000) })}</span>
    </div>
  );
}

export function EmoteBar() {
  const t = useT();
  const app = useController();
  return (
    <div className="emote-bar" role="group" aria-label={t('emote.label')}>
      {EMOTES.map((emote) => (
        <button key={emote} type="button" className="emote-btn" onClick={() => app.sendEmote(emote)} aria-label={emote}>
          {emote}
        </button>
      ))}
    </div>
  );
}

export function EmoteFloat() {
  const emotes = useApp((s) => s.emotes);
  const room = useApp((s) => s.room);
  return (
    <div className="emote-float" aria-hidden="true">
      {emotes.map((e) => (
        <div key={e.id} className="emote-bubble">
          <span className="emote-face">{e.emote}</span>
          <span className="emote-who">{nameIn(room, e.fromId)}</span>
        </div>
      ))}
    </div>
  );
}

/** Game history in the viewer's language. Newest at the bottom. */
export function Log() {
  const t = useT();
  const log = useApp((s) => s.log);
  const room = useApp((s) => s.room);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  const ctx = { t, name: (id: string) => nameIn(room, id) };
  return (
    <div className="log" aria-label={t('log.title')}>
      <h3 className="log-title">{t('log.title')}</h3>
      <ol className="log-list">
        {log.map((entry) => {
          if (entry.event === null) {
            return <li key={entry.seq} className="log-line tone-info log-gap">{t('log.gap')}</li>;
          }
          const line = describeEvent(entry.event, ctx);
          return line ? (
            <li key={entry.seq} className={`log-line tone-${line.tone}`}>
              {line.text}
            </li>
          ) : null;
        })}
      </ol>
      <div ref={end} />
    </div>
  );
}
