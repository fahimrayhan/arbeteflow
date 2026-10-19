import {
  BriefcaseBusiness,
  FileText,
  Kanban,
  Mail,
  MessageSquare,
  Search,
  Settings,
  BookOpen,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';
import type { View } from '../lib/types';

export type NavigationItem = {
  id: View;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const NAV_ITEMS: NavigationItem[] = [
  {
    id: 'resume',
    label: 'Resume',
    icon: FileText,
    description: 'Import and improve your CV',
  },
  {
    id: 'coverletter',
    label: 'Cover Letter',
    icon: Mail,
    description: 'Generate tailored applications',
  },
  {
    id: 'chat',
    label: 'AI Coach',
    icon: MessageSquare,
    description: 'Career advice and feedback',
  },
  {
    id: 'interview',
    label: 'Interview Practice',
    icon: BriefcaseBusiness,
    description: 'Practice with an AI interviewer',
  },
  {
    id: 'finder',
    label: 'Job Finder',
    icon: Search,
    description: 'Search and match Swedish listings',
  },
  {
    id: 'tracker',
    label: 'Job Tracker',
    icon: Kanban,
    description: 'Track applications and saved jobs',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Local app preferences',
  },
  {
    id: 'learn',
    label: 'Responsible AI',
    icon: BookOpen,
    description: 'How it works, privacy, and fairness',
  },
  {
    id: 'faq',
    label: 'FAQ',
    icon: CircleHelp,
    description: 'Answers about data and AI limits',
  },
];
