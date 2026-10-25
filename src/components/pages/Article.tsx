import { useState, type ReactNode } from 'react';
import { ArrowRight, ExternalLink, Play } from 'lucide-react';
import { getLang, tr } from '../../i18n';
import { loadLesson } from '../../state/actions';
import { lessonById, sheetNumber } from '../../curriculum/lessons';
import { videoById, type Level, type Reading, type Tool, type Video } from '../../curriculum/resources';

/** A reading page laid on the drawing sheet: one comfortable column. */
export function Article({ children }: { children: ReactNode }) {
  return <article className="mx-auto max-w-[760px] pb-6 text-[15px] leading-[1.75] text-ink-2">{children}</article>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[18px] leading-[1.6] text-ink">{children}</p>;
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mt-9 scroll-mt-4 border-b border-rule-2 pb-1.5 text-[22px] font-semibold tracking-tight text-ink first:mt-2">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 text-[15px] font-semibold text-ink">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-2.5">{children}</p>;
}

/** A term set in the text's own colour, slightly heavier. */
export function T({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>;
}

/** A ruled box for a key point, tip or warning (full border, never a side stripe). */
export function Callout({ title, children, tone = 'note' }: { title: ReactNode; children: ReactNode; tone?: 'note' | 'tip' | 'warn' }) {
  const cls = tone === 'tip' ? 'border-ok/40 bg-ok-soft' : tone === 'warn' ? 'border-warn/50 bg-warn-soft' : 'border-rule-2 bg-paper-2';
  return (
    <div className={`mt-4 rounded-[3px] border px-4 py-3 ${cls}`}>
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      <div className="mt-1 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** A link to another sheet of this app. */
export function SheetLink({ to, children }: { to: string; children?: ReactNode }) {
  const l = lessonById(to);
  if (!l) return null;
  return (
    <button type="button" onClick={() => loadLesson(to)}
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-rule-2 bg-paper px-2.5 py-1 align-middle text-[14px] text-ink transition-colors hover:border-ink hover:bg-paper-2">
      <span className="tnum text-[12px] text-ink-3">{sheetNumber(to)}</span>
      <span>{children ?? l.title}</span>
      <ArrowRight size={14} className="text-ink-3" />
    </button>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-baseline gap-0.5 text-info underline decoration-info/40 underline-offset-2 hover:decoration-info">
      {children}<ExternalLink size={12} className="self-center" aria-hidden />
    </a>
  );
}

const LEVEL: Record<Level, () => string> = {
  beginner: () => tr('입문', 'Beginner'),
  intermediate: () => tr('중급', 'Intermediate'),
  advanced: () => tr('심화', 'Advanced'),
};

export function LevelTag({ level }: { level: Level }) {
  return <span className="lettering rounded-[2px] border border-rule-2 px-1.5 pt-px text-[12px] text-ink-3">{LEVEL[level]()}</span>;
}

const SPOKEN: Record<Video['lang'], () => string> = {
  en: () => tr('영어', 'English'),
  ko: () => tr('한국어', 'Korean'),
  ja: () => tr('일본어', 'Japanese'),
  none: () => tr('말 없음', 'No narration'),
};

/** YouTube video id from a watch / youtu.be / embed URL. */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/**
 * A video as a card: the thumbnail plays the video in place (privacy-enhanced
 * embed); the title opens it on YouTube.
 */
export function VideoCard({ video, compact }: { video: Video; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(video.url);
  const about = getLang() === 'en' ? video.about.en : video.about.ko;
  return (
    <div className={`overflow-hidden rounded-[3px] border border-rule-2 bg-paper ${compact ? '' : 'flex flex-col'}`}>
      {id && (
        <div className="relative aspect-video bg-ink/90">
          {playing ? (
            <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={tr(`여기서 재생: ${video.title}`, `Play here: ${video.title}`)}>
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
              <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper/95 text-ink shadow transition-transform group-hover:scale-105">
                <Play size={20} className="ml-0.5" />
              </span>
            </button>
          )}
        </div>
      )}
      <div className="px-3 py-2.5">
        <a href={video.url} target="_blank" rel="noreferrer noopener" className="text-[14px] font-semibold leading-snug text-ink hover:underline">{video.title}</a>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
          <span>{video.channel}</span>
          <span>· {SPOKEN[video.lang]()}</span>
          {video.minutes && <span className="tnum">· {video.minutes}{tr('분', ' min')}</span>}
          <LevelTag level={video.level} />
        </div>
        {!compact && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{about}</p>}
      </div>
    </div>
  );
}

/** Videos by id, as a responsive grid. Unknown ids are skipped. */
export function VideoGrid({ ids, compact }: { ids: string[]; compact?: boolean }) {
  const vids = ids.map(videoById).filter((v): v is Video => !!v);
  if (!vids.length) return null;
  return (
    <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {vids.map((v) => <VideoCard key={v.id} video={v} compact={compact} />)}
    </div>
  );
}

const KIND: Record<Tool['kind'], () => string> = {
  design: () => tr('설계', 'Design'),
  simulate: () => tr('시뮬레이션', 'Simulation'),
  format: () => tr('파일 형식', 'File format'),
  library: () => tr('라이브러리', 'Library'),
  learn: () => tr('학습', 'Learning'),
};

export function ToolCard({ tool }: { tool: Tool }) {
  const en = getLang() === 'en';
  return (
    <div className="flex flex-col rounded-[3px] border border-rule-2 bg-paper px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <a href={tool.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[15px] font-semibold text-ink hover:underline">
          {tool.name}<ExternalLink size={13} className="text-ink-3" aria-hidden />
        </a>
        <span className="lettering text-[12px] text-ink-3">{KIND[tool.kind]()}</span>
      </div>
      <div className="text-[13px] text-ink-3">{tool.author} · {en ? tool.platform.en : tool.platform.ko}{tool.free ? tr(' · 무료', ' · free') : ''}</div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{en ? tool.what.en : tool.what.ko}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink"><span className="text-ink-3">{tr('이럴 때: ', 'Use it to: ')}</span>{en ? tool.useFor.en : tool.useFor.ko}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[12px] text-ink-3">
        <LevelTag level={tool.level} />
        {tool.license && <span>{tr('라이선스', 'Licence')}: {tool.license}</span>}
        {tool.repo && <a href={tool.repo} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:text-ink hover:underline">{tr('소스 코드', 'Source')}</a>}
      </div>
    </div>
  );
}

const READ_KIND: Record<Reading['kind'], () => string> = {
  book: () => tr('책', 'Book'),
  course: () => tr('강의', 'Course'),
  paper: () => tr('논문', 'Paper'),
  site: () => tr('사이트', 'Website'),
  community: () => tr('모임', 'Community'),
};

export function ReadingRow({ r }: { r: Reading }) {
  const en = getLang() === 'en';
  return (
    <li className="border-t border-dashed border-rule-2 py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="lettering text-[12px] text-ink-3">{READ_KIND[r.kind]()}</span>
        {r.url ? <ExtLink href={r.url}><span className="font-semibold">{r.title}</span></ExtLink> : <span className="font-semibold text-ink">{r.title}</span>}
        <span className="text-[13px] text-ink-3">{r.author}{r.year ? `, ${r.year}` : ''}</span>
        <LevelTag level={r.level} />
      </div>
      <p className="text-[14px] leading-relaxed text-ink-2">{en ? r.about.en : r.about.ko}</p>
    </li>
  );
}
