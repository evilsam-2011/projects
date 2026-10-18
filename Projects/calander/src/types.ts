export type Status = 'todo' | 'doing' | 'done';

export interface Todo {
  id: string;
  text: string;
  status: Status;
  daily?: boolean;
  created: string;
  subtasks: any[]; // Consider defining a Subtask interface
  pomodoros: number;
  pomoTarget: number;
  dueDate?: string;
  order: number;
  points: number;
  done?: boolean;
}

export interface CalendarEvent {
  id: string;
  name: string;
  date: string;
  start: string;
  end: string;
  daily?: boolean;
  calendarId: string;
  syncToTodo?: boolean;
  pomodoro?: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

export interface PointLog {
  id: string;
  timestamp: string;
  points: number;
  reason: string;
  todoId?: string;
}

export const STORAGE_KEYS = {
  TODOS: 'calander-todos',
  CALENDAR: 'calander-events',
  CALENDARS: 'calander-calendars',
  LOGS: 'calander-point-logs',
  SETTINGS: 'calander-settings',
};
