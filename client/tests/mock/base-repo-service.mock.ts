import { BehaviorSubject, map } from 'rxjs';
import { Observable } from 'rxjs';
import { Id } from 'src/app/domain/definitions/key-types';
import { BaseViewModel } from 'src/app/site/base/base-view-model';
import { Fieldsets } from 'src/app/site/services/model-request-builder';

export class BaseRepoServiceMock<V extends BaseViewModel> {
    public collection = `model`;
    public viewModelSubjects: { [modelId: number]: BehaviorSubject<V | null> } = {};
    public viewModelStoreSubject = new BehaviorSubject<{ [modelId: number]: V }>({});

    public get COLLECTION(): string {
        return this.collection;
    }

    public verboseName = `ModelName`;
    public verboseNamePlural = `ModelNamePlural`;
    public getVerboseName(plural?: boolean) {
        return plural ? this.verboseNamePlural : this.verboseName;
    }

    public getTitle(viewModel: V): string {
        return (<any>viewModel)?.title;
    }

    public getViewModel(id: Id): V | null {
        const model = this.viewModelStoreSubject.getValue()[id];
        return model?.canAccess() ? model : null;
    }

    public getViewModelUnsafe(id: Id): V {
        return this.viewModelStoreSubject.getValue()[id];
    }

    public getViewModelList(): V[] {
        return Object.values(this.viewModelStoreSubject.getValue()).filter(m => m.canAccess());
    }

    public getViewModelListUnsafe(): V[] {
        return Object.values(this.viewModelStoreSubject.getValue());
    }

    public getViewModelListUnsafeObservable(): Observable<V[]> {
        return this.viewModelStoreSubject.pipe(map(x => Object.values(x))) as Observable<V[]>;
    }

    public getSortedViewModelList(): V[] {
        return Object.values(this.viewModelStoreSubject.getValue()) || [];
    }

    public getListTitle: (viewModel: V) => string = (viewModel: V) => this.getTitle(viewModel);

    public deleteModels(ids: Id[]): void {
        const val = this.viewModelStoreSubject.getValue();
        ids.forEach(id => {
            delete val[id];
        });
        this.viewModelStoreSubject.next(val);
    }

    public changedModels(ids: Id[]): void {}

    public getViewModelObservable(id: Id): Observable<V | null> {
        if (!this.viewModelSubjects[id]) {
            this.viewModelSubjects[id] = new BehaviorSubject<V | null>(this.getViewModel(id));
        }
        return this.viewModelSubjects[id];
    }

    public getViewModelListObservable(): Observable<V[]> {
        return this.getViewModelListUnsafeObservable();
    }

    public getGeneralViewModelObservable(): Observable<V> {
        return null;
    }

    public getModifiedIdsObservable(): Observable<Id[]> {
        return null;
    }

    public getViewModelMapObservable(): Observable<{ [id: number]: V }> {
        return this.viewModelStoreSubject;
    }

    public commitUpdate(modelIds: Id[]): void {}

    public registerCreateViewModelPipe(fn: (viewModel: V) => void): void {}

    public getFieldsets(): Fieldsets<any> {
        return {};
    }
}
