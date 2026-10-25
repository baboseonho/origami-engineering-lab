import { tr } from '../../i18n';
import { lessonById } from '../../curriculum/lessons';
import { READINGS } from '../../curriculum/resources';
import { Article, Callout, H2, H3, Lead, P, ReadingRow, SheetLink, T, VideoGrid } from './Article';

const STEPS = () => [
  { title: tr('전통 작품', 'Traditional models'), text: tr('학, 개구리, 상자. 기본 동작과 기본형이 손에 익는다.', 'Crane, frog, box. The basic moves and bases become second nature.') },
  { title: tr('모듈러 오리가미', 'Modular origami'), text: tr('같은 단위를 여러 개 접어 끼워 맞춘다(예: 소노베 단위로 만드는 다면체). 정확하게 반복하는 연습이 된다.', 'Fold many identical units and slot them together (for example polyhedra from Sonobe units). Great practice in folding precisely and consistently.') },
  { title: tr('테셀레이션', 'Tessellations'), text: tr('격자를 미리 접고 꼬아 접기와 플리트를 반복해 무늬를 만든다. 이 앱의 패턴들과 가장 가깝다.', 'Pre-crease a grid and repeat twists and pleats into a pattern. Closest to the patterns in this app.') },
  { title: tr('직접 설계하기', 'Designing your own'), text: tr('박스 플리팅이나 트리 방법으로 원하는 모양을 설계한다. 도구 도면의 TreeMaker, ORIPA가 여기서 쓰인다.', 'Use box pleating or the tree method to design a shape you want. TreeMaker and ORIPA on the tools sheet come in here.') },
];

export function HobbyPage() {
  const videos = lessonById('l7-hobby')?.videos ?? [];
  const community = READINGS.filter((r) => r.kind === 'community' || r.kind === 'site');
  const books = READINGS.filter((r) => r.kind === 'book');
  return (
    <Article>
      <Lead>{tr('오리가미는 종이 한 장으로 어디서든 할 수 있는 취미다. 손으로 접는 즐거움과, 왜 그렇게 접히는지 아는 즐거움을 함께 가져가 보자.', 'Origami is a hobby you can take anywhere with one sheet of paper. Keep both pleasures: folding with your hands and knowing why it folds.')}</Lead>

      <H2>{tr('종이 고르기', 'Choosing paper')}</H2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>{tr(<><T>색종이 (kami)</T>: 얇고 싸고 접은 선이 잘 남는다. 전통 작품 연습용.</>, <><T>Kami</T>: thin, cheap, holds a crease well. For practising traditional models.</>)}</li>
        <li>{tr(<><T>복사지, 트레이싱지</T>: 테셀레이션과 인쇄한 전개도용. 트레이싱지는 빛에 비추면 겹친 층이 보여 아름답다.</>, <><T>Copy paper, tracing paper</T>: for tessellations and printed patterns. Tracing paper shows the stacked layers beautifully against light.</>)}</li>
        <li>{tr(<><T>탄트지, 한지, 와시</T>: 질기고 결이 고와 여러 번 접는 복잡한 작품에 좋다.</>, <><T>Tant, hanji, washi</T>: strong and fine-grained, good for complex models folded many times.</>)}</li>
        <li>{tr(<><T>호일 종이</T>: 모양을 잘 유지해 곡면이나 동물 작품의 마무리에 쓴다.</>, <><T>Foil paper</T>: holds its shape, used for curves and finishing animal models.</>)}</li>
      </ul>

      <H2>{tr('실력을 키우는 순서', 'A path to get better')}</H2>
      <ol className="mt-3 space-y-2.5">
        {STEPS().map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-3 text-[13px] text-ink-2">{i + 1}</span>
            <div><div className="font-semibold text-ink">{s.title}</div><div className="text-[14px] leading-relaxed">{s.text}</div></div>
          </li>
        ))}
      </ol>

      <H2>{tr('잘 접는 요령', 'Tips for clean folds')}</H2>
      <H3>{tr('정확하게', 'Accurately')}</H3>
      <P>{tr('모서리와 모서리, 모서리와 선을 먼저 정확히 맞춘 다음, 가운데에서 바깥쪽으로 눌러 선을 만든다. 첫 몇 번의 접기가 틀어지면 끝까지 따라온다.', 'Line up corner to corner or edge to line first, then press the crease from the middle outwards. Errors in the first few folds carry all the way through.')}</P>
      <H3>{tr('천천히 모으기', 'Collapse slowly')}</H3>
      <P>{tr('여러 선을 동시에 접을 때는 한쪽 끝부터 조금씩, 모든 선을 조금씩 함께 접어 간다. 한 곳만 끝까지 접으면 나머지가 따라오지 못한다. 이 앱의 "패턴 전체 접기" 슬라이더가 바로 이 과정을 보여 준다.', 'When many lines fold together, work from one end and fold every line a little at a time. Folding one place all the way leaves the rest unable to follow. The "fold the whole pattern" slider in this app shows exactly this.')}</P>
      <div className="mt-2 flex flex-wrap gap-1.5"><SheetLink to="l4-miura" /><SheetLink to="l4-waterbomb" /></div>

      {books.length > 0 && (<><H2>{tr('책', 'Books')}</H2><ul className="mt-2">{books.map((r) => <ReadingRow key={r.id} r={r} />)}</ul></>)}
      {community.length > 0 && (<><H2>{tr('모임과 자료실', 'Communities and diagram collections')}</H2><ul className="mt-2">{community.map((r) => <ReadingRow key={r.id} r={r} />)}</ul></>)}

      <Callout title={tr('저작권 한 가지', 'One note on copyright')}>
        {tr('작품의 크리스 패턴과 접는 법(diagram)은 대개 창작자의 저작물이다. 개인적으로 접는 것은 자유롭지만, 다른 사람의 작품을 배포하거나 팔 때는 출처를 밝히고 허락을 구하는 것이 오리가미 커뮤니티의 관례다.', 'Crease patterns and diagrams of a model are usually the creator\'s work. Folding them for yourself is fine; when sharing or selling someone else\'s design, credit them and ask permission, as the origami community expects.')}
      </Callout>
      {videos.length > 0 && (<><H2>{tr('영상', 'Videos')}</H2><VideoGrid ids={videos} /></>)}
    </Article>
  );
}
