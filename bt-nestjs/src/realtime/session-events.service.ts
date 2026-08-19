import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

// Sự kiện phiên đăng nhập đẩy tới client qua SSE. Hiện dùng cho việc đổi/thu hồi quyền:
// người bị ảnh hưởng sẽ bị đăng xuất ngay lập tức ở phía trình duyệt.
export interface SessionEvent {
  userId: string;
  type: 'role-changed';
}

@Injectable()
export class SessionEventsService {
  private readonly events$ = new Subject<SessionEvent>();

  stream(): Observable<SessionEvent> {
    return this.events$.asObservable();
  }

  emitRoleChanged(userId: string): void {
    this.events$.next({ userId, type: 'role-changed' });
  }
}
