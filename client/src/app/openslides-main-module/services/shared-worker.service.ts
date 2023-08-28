import { Injectable, NgZone } from '@angular/core';
import { filter, Observable, Subject } from 'rxjs';
import { OpenSlidesStatusService } from 'src/app/site/services/openslides-status.service';
import { WorkerMessage, WorkerMessageContent, WorkerResponse } from 'src/app/worker/interfaces';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: `root`
})
export class SharedWorkerService {
    public messages: Subject<WorkerResponse> = new Subject();

    private conn: MessagePort | Window;
    private _ready = false;
    private readyTimeout = null;

    private get ready() {
        return this._ready;
    }

    private set ready(ready) {
        if (ready) {
            this.readyTimeout = setTimeout(() => {this._ready = true; console.log(`Ready`)}, 1000);
        } else {
            clearTimeout(this.readyTimeout);
            this._ready = false;
        }
    }

    constructor(private zone: NgZone, private appState: OpenSlidesStatusService) {
        this.connect();
        this.setupPingPong();
        this.handleBrowserReload();
    }

    /**
     * Listen to messages from the worker of a specific sender
     *
     * @param sender Name of the sender
     */
    public listenTo(sender: string): Observable<WorkerResponse> {
        return this.messages.pipe(filter(data => data?.sender === sender || data?.sender === `system`));
    }

    /**
     * Sends a message to the worker
     *
     * @param receiver Name of the receiver
     * @param msg Content of the message
     */
    public sendMessage<T extends WorkerMessageContent>(receiver: string, msg: T): void {
        this.sendRawMessage({ receiver, msg } as WorkerMessage);
    }

    private connect(): void {
        console.log(`Connected shared worker`);
        if (environment.autoupdateOnSharedWorker) {
            try {
                const worker = new SharedWorker(new URL(`./default-shared-worker.worker`, import.meta.url), {
                    name: `openslides-shared-worker`
                });
                this.conn = worker.port;
                this.registerMessageListener();
                worker.port.start();
            } catch (e) {
                this.setupInWindowAu();
            }
        } else {
            this.setupInWindowAu();
        }
    }

    private reconnect(): void {
        if (this.conn !== window) {
            this.ready = false;
            this.sendMessage(`worker`, { action: `terminate` });
            this.conn = null;
            setTimeout(() => {
                if (!this.conn) {
                    this.connect();
                }
            });
        }
    }

    private setupInWindowAu(): void {
        this.conn = window;
        this.registerMessageListener();
        this.zone.runOutsideAngular(() => {
            import(`./default-shared-worker.worker`);
        });
    }

    private async setupPingPong(): Promise<void> {
        await this.appState.stable;
        let received = false;
        let failCount = 0;
        setInterval(() => {
            received = false;
            this.sendMessage(`worker`, { action: `ping` });
            setTimeout(() => {
                if (!received) {
                    failCount++;
                }

                if (failCount >= 3) {
                    this.reconnect();
                    failCount = 0;
                }
            }, 7500);
        }, 10000);

        this.listenTo(`worker`).subscribe((msg: WorkerResponse) => {
            if (msg.action === `pong`) {
                received = true;
                failCount = 0;
            }
        });
    }

    private registerMessageListener(): void {
        this.conn.addEventListener(`message`, (e: any) => {
            if (this.ready && e?.data?.sender) {
                this.messages.next(e?.data);
            } else if (e?.data === `ready`) {
                this.ready = true;
            } else if (e?.data?.action === `terminating`) {
                this.ready = false;
                setTimeout(() => {
                    this.connect();
                }, 1000);
            }
        });
    }

    private sendRawMessage(message: any): void {
        if (this.ready) {
            console.log(message);
            this.conn.postMessage(message);
        } else {
            setTimeout(() => this.sendRawMessage(message), 10);
        }
    }

    private handleBrowserReload(): void {
        if (
            (window.performance.navigation && window.performance.navigation.type === 1) ||
            (window.performance.getEntriesByType &&
                window.performance
                    .getEntriesByType(`navigation`)
                    .map(nav => nav.name)
                    .includes(`reload`))
        ) {
            /*
            this.ready = false;
            this.sendMessage(`worker`, {
                action: `terminate`
            });
            */
        }
    }
}
