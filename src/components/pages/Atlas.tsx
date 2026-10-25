import { tr } from '../../i18n';
import { Article, Lead } from './Article';
import { StructurePicker } from './StructurePicker';

/** Every structure in the app, chosen by field of interest or by name. */
export function AtlasPage() {
  return (
    <Article>
      <Lead>{tr('이 앱에서 접어 볼 수 있는 구조를 모두 모았다. 관심 분야를 고르거나 이름으로 찾아서, 마음에 드는 구조부터 열어 보자.', 'Every structure you can fold in this app. Choose a field of interest or search by name, and open whichever catches your eye.')}</Lead>
      <StructurePicker search />
    </Article>
  );
}
