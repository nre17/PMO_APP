import type { PageProps, Stage, WorkflowKind } from '../shared/types';
import { Delivery } from './Delivery';
import Dashboard from './Dashboard';
import MyWork from './MyWork';
import { WORK_VIEWS, type WorkView } from './navigation';
import './work-workspace.css';

type Props = PageProps & {
  view: WorkView; onView: (view: WorkView) => void;
  navigate: (page: string, filter?: string) => void; startMeeting: () => void;
  initialFilter: string; initialStage?: Stage; initialKind?: WorkflowKind;
  search: string; setSearch: (value: string) => void;
  workstream: string; setWorkstream: (value: string) => void; createItem: () => void;
};
export default function WorkWorkspace(props: Props) {
  const { state, view, onView } = props;
  return <div className="work-workspace">
    <header className="work-heading"><div><h1>Work</h1><p>Find a commitment, move it forward, or get a decision when it is stuck.</p></div><span>{state.items.filter(item => item.stage !== 'Closed').length} active · {state.items.filter(item => item.stage === 'Closed').length} closed</span></header>
    <nav className="work-views" aria-label="Work views">{WORK_VIEWS.map(option => <a key={option.id} href={'#work' + (option.id === 'all' ? '' : `?view=${option.id}`)} aria-current={view === option.id ? 'page' : undefined} onClick={event => { event.preventDefault(); onView(option.id); }}>{option.label}</a>)}</nav>
    {view === 'attention' ? <Dashboard {...props} onRegister={props.openRegister} startMeeting={props.startMeeting} />
      : view === 'mine' ? <div className="work-personal-view"><MyWork {...props}/></div>
      : <Delivery {...props} embedded initialTab={view === 'milestones' ? 'milestones' : view === 'artifacts' ? 'deliverables' : 'work'}/>}
  </div>;
}
