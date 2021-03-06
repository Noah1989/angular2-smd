﻿import {
    Component,
    Directive,
    ViewEncapsulation,
    Input,
    Output,
    Inject,
    forwardRef,
    EventEmitter,
    DoCheck,
    IterableDiffers,
    ViewChild,
    ContentChild,
    ContentChildren,
    QueryList,
    EmbeddedViewRef,
    TemplateRef,
    ViewContainerRef,
    AfterContentInit,
    OnInit,
    OnChanges,
    OnDestroy,
    HostBinding,
    HostListener,
    ChangeDetectorRef,
    AfterViewChecked
} from '@angular/core';
import { isNullOrUndefined } from 'util';
import { SmdPaginatorComponent } from '../smd-paginator/paginator.component';
import { Subscription } from 'rxjs';
import { MatDialogRef, MatDialog, MatDialogConfig } from '@angular/material';

let columnIds = 0;

export class SmdDataRowModel {
    originalOrder?: number;

    constructor(public model: any,
                public checked?: boolean) {
    }
}

@Component({
    selector: 'smd-change-value-dialog',
    template: `
        <h1 *ngIf="title" mat-dialog-title>{{title}}</h1>
        <mat-dialog-content>
            <mat-input-container>
                <input type="text" matInput [placeholder]="placeholder" [(ngModel)]="value">
            </mat-input-container>
        </mat-dialog-content>
        <mat-dialog-actions>
            <button type="button" mat-button (click)="_cancel()">Cancel</button>
            <button type="button" mat-button (click)="_save()">Save</button>
        </mat-dialog-actions>
    `,
    styles: [`
        * {
            font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        mat-dialog-actions {
            float: right;
        }

        mat-dialog-content {
            min-width: 150px;
            padding: 5px 30px;
        }
    `]
})
export class SmdDatatableDialogChangeValueComponent {

    title: string;
    placeholder: string;
    value: string;

    constructor(public dialogRef: MatDialogRef<SmdDatatableDialogChangeValueComponent>) {
    }

    _save() {
        this.dialogRef.close(this.value ? this.value : '');
    }

    _cancel() {
        this.dialogRef.close();
    }
}

@Directive({
    selector: '[smdDataCell]'
})
export class SmdDataTableCellDirective implements OnInit, OnDestroy, OnChanges {
    @Input() column: SmdDataTableColumnComponent;
    @Input() data: any;
    @Input() templ: TemplateRef<SmdDataTableCellDirective>;

    childView: EmbeddedViewRef<SmdDataTableCellDirective>;

    constructor(private _viewContainer: ViewContainerRef) { }

    ngOnInit(): void {
        if (this._viewContainer && this.templ) {
            this.childView = this._viewContainer.createEmbeddedView(this.templ, this);
        }
    }

    ngOnDestroy(): void {
        if (this.childView) {
            this.childView.destroy();
        }
    }

    ngOnChanges(): void {
      if (this.childView) {
        this.childView.reattach();
      }
    }

}

@Directive({
  selector: 'td[smdDataTableClickable]'
})
export class SmdDataTableClickableDirective {
    dataTable: SmdDataTableRowComponent;
    parentDataTable: any;

    @HostListener('click', ['$event']) getClickFn(event: MouseEvent) {
      if (this._parent.clickable) {
        return this.parentDataTable.clickFn.emit(this.dataTable.row.model);
      }
    }

    constructor(@Inject(forwardRef(() => SmdDataTableComponent)) private _parent: SmdDataTableComponent,
                @Inject(forwardRef(() => SmdDataTableRowComponent)) private _row: SmdDataTableRowComponent) {
                  this.parentDataTable = this._parent;
                  this.dataTable = this._row;
    }
}

@Component({
    selector: 'smd-datatable-row',
    template: `
        <td *ngIf="renderCheckbox" class="smd-datatable-body-checkbox">
            <div class="smd-checkbox">
                <mat-checkbox [(ngModel)]="row.checked"
                  (change)="parentDataTable._onRowCheckChange(row)" color="primary" [disabled]="parentDataTable.disableCheckbox">
                </mat-checkbox>
            </div>
        </td>
        <td smdDataTableClickable *ngFor="let column of columns"
            [class.smd-numeric-column]="column.numeric"
            [class.smd-editable]="column.editable"
            (click)="_onClick(column, row.model)">
            <span class="smd-column-title">
                {{column.title}}
            </span>
            <span class="smd-cell-data">
                <ng-template smdDataCell [column]="column" [data]="row.model" [templ]="column.template"></ng-template>
                <span class="smd-editable-field-placeholder" *ngIf="column.editable && !row.model[column.field]">
                    {{column.editablePlaceholder}}
                </span>
            </span>
        </td>
    `,
})
export class SmdDataTableRowComponent implements OnInit {
    @Input() row: SmdDataRowModel;
    @Input() renderCheckbox: boolean;
    @Input() columns: SmdDataTableColumnComponent[];
    parentDataTable: any;

    // tslint:disable-next-line:no-forward-ref
    constructor(@Inject(forwardRef(() => SmdDataTableComponent)) private _parent: SmdDataTableComponent,
                private dialog: MatDialog, private viewContainerRef: ViewContainerRef) {
                  this.parentDataTable = this._parent;
    }

    /**
     * @TODO: Dynamically add Clickable Directive to td
     */
    ngOnInit() {
      // Init
    }

    _onClick(column: SmdDataTableColumnComponent, model: any) {
        if (column.editable) {
            let dialogRef: MatDialogRef<SmdDatatableDialogChangeValueComponent>;
            let dialogConfig = new MatDialogConfig();
            dialogConfig.viewContainerRef = this.viewContainerRef;

            dialogRef = this.dialog.open(SmdDatatableDialogChangeValueComponent, dialogConfig);

            dialogRef.componentInstance.title = column.editablePlaceholder;
            dialogRef.componentInstance.placeholder = column.title;
            dialogRef.componentInstance.value = model[column.field];

            dialogRef.afterClosed().subscribe((result) => {
                if (typeof result === 'string') {
                    let oldValue = model[column.field];
                    if (oldValue !== result) {
                        model[column.field] = result;
                        column.onFieldChange.emit({
                            model: model,
                            field: column.field,
                            oldValue: oldValue,
                            newValue: result
                        });
                    }
                }
            });
        }
    }

}

@Component({
    selector: 'smd-datatable-column',
    template: `<ng-content select="template" *ngIf="_template"></ng-content>
        <ng-template #internalTemplate let-model="data">
            {{getFieldValue(model)}}
        </ng-template>
    `
})
export class SmdDataTableColumnComponent implements OnInit, OnChanges, AfterViewChecked {
    sortDir?: 'asc' | 'desc' = null;
    id: string = '' + ++columnIds;

    @Input() title: string;
    @Input() titleTooltip: string;
    @Input() field: string;
    @Input() numeric: boolean = false;
    @Input() sortable: boolean = false;
    @Input() sortFn: (a: any, b: any, sortDir: string) => number;
    @Input() filterFn: (a: any, text: string) => boolean;
    @Input() editable: boolean = false;
    @Input() editablePlaceholder: string;
    @Input() searchable: boolean = false;
    @Input() notNull: boolean = false;
    @Input() search: string;
    _template: boolean = false;

    @ContentChild(TemplateRef) _customTemplate: TemplateRef<Object>;
    @ViewChild('internalTemplate') _internalTemplate: TemplateRef<Object>;

    @Output() onFieldChange: EventEmitter<any> = new EventEmitter<any>();

    get template() {
        return this._customTemplate ? this._customTemplate : this._internalTemplate;
    }

    get hasCustomTemplate(): boolean {
        return !!this._customTemplate;
    }

    constructor(public changeDetector: ChangeDetectorRef) {}

    ngOnInit(): void {
        if (!this.title) {
            throw new Error('Title is mandatory on smd-datatable-column');
        }
        if (!this.field) {
            throw new Error('Field is mandatory on smd-datatable-column');
        }
        if (this.sortable && this.searchable) {
            this.sortable = false;
        }
    }

    ngAfterViewChecked(): void {
      this.changeDetector.detectChanges();
    }

    ngOnChanges(changes: any) {
      // OnChange
      if (this.hasCustomTemplate) {
        this._template = true;
      }
    }

    getFieldValue(model: any) {
        let value = model[this.field];
        return value;
    }
}

@Component({
    selector: 'smd-datatable-action-button',
    template: `
        <button mat-button
                *ngIf="_checkButtonIsVisible()"
                (click)="_onButtonClick($event)">
            <span>{{label}}</span>
            <mat-icon>{{icon}}</mat-icon>
        </button>
    `
})
export class SmdDatatableActionButtonComponent {
    @Input() label: string;
    @Input() icon: string;
    @Output() onClick: EventEmitter<void> = new EventEmitter<void>();

    // tslint:disable-next-line:no-forward-ref
    constructor(@Inject(forwardRef(() => SmdDataTableComponent)) private _parent: SmdDataTableComponent) {
    }

    _onButtonClick(event: Event) {
        this.onClick.emit();
    }

    _checkButtonIsVisible() {
        return this._parent.selectedRows().length === 0;
    }
}

@Component({
    selector: 'smd-datatable-title',
    template: `
        <span class="datatable-title">
            {{title}} {{extra}}
        </span>
    `
})
export class SmdDatatableTitleComponent {
    @Input() title: string;
    @Input() extra: string;
}


@Component({
    selector: 'smd-datatable-contextual-button',
    template: `
        <button mat-icon-button
                *ngIf="_checkButtonIsVisible()"
                (click)="_onButtonClick($event)">
            <mat-icon>{{icon}}</mat-icon>
        </button>
    `
})
export class SmdContextualDatatableButtonComponent {
    @Input() icon: string;
    @Input() minimunSelected: number = -1;
    @Input() maxSelected: number = -1;
    @Output() onClick: EventEmitter<any[]> = new EventEmitter<any[]>();

    constructor(@Inject(forwardRef(() => SmdDataTableComponent)) private _parent: SmdDataTableComponent) {
    }

    _onButtonClick(event: Event) {
        this.onClick.emit(this._parent.selectedModels());
    }

    _checkButtonIsVisible() {
        let shouldShow = true;
        if (this.minimunSelected != null && this.minimunSelected > 0 && this._parent.selectedRows().length < this.minimunSelected) {
            shouldShow = false;
        }
        if (shouldShow && this.maxSelected > 0 && this._parent.selectedRows().length > this.maxSelected) {
            shouldShow = false;
        }
        return shouldShow;
    }
}


@Component({
    selector: 'smd-datatable-header',
    template: `
        <div>
            <span *ngIf="title && !_hasRowsSelected()">{{title}}</span>
            <ng-content select="smd-datatable-action-button"></ng-content>
            <span *ngIf="_hasRowsSelected()">
                {{_selectedRowsLength()}} {{_selectedRowsLength() == 1 ? 'item selected' : 'items selected'}}
            </span>
        </div>
        <ng-content select="smd-datatable-title"></ng-content>
        <span>
            <div>
                <mat-input-container *ngIf="enableFilter && _selectedRowsLength() == 0">
                  <input matInput [placeholder]="filterLabel" [(ngModel)]="filterValue" (keyup)="_onFilter($event)">
                </mat-input-container>
                <ng-content select="smd-datatable-contextual-button"></ng-content>
            </div>
        </span>
    `
})
export class SmdDatatableHeaderComponent implements AfterContentInit, OnDestroy {

    private filterTimeout: any;
    filterValue: string;

    @Input() title: string = null;
    @Input() enableFilter: boolean = false;
    @Input() filterLabel: string = 'Filter';
    @Input() filterDelay: number = 500;
    @Input() multiCheck: boolean = false;
    @Input() singleCheck: boolean = false;


    @ContentChildren(SmdDatatableActionButtonComponent) actionButtons: QueryList<SmdDatatableActionButtonComponent>;
    @ContentChildren(SmdContextualDatatableButtonComponent) contextualButtons: QueryList<SmdContextualDatatableButtonComponent>;

    @HostBinding('class.is-selected') get cSelected() { return this._hasRowsSelected(); }
    @HostBinding('class.clickable') get cClickable() { return this._parent.enableClick(); }

    @HostListener('_hasRowsSelected') _hasRowsSelected(): boolean {
        return this._parent.selectedRows().length > 0;
    }

    // tslint:disable-next-line:no-forward-ref
    constructor(@Inject(forwardRef(() => SmdDataTableComponent)) private _parent: SmdDataTableComponent) {
    }

    shouldRenderCheckbox() {
        let render;
        if (this.contextualButtons) {
            render =  this.contextualButtons && this.contextualButtons.toArray().filter(
                (button: SmdContextualDatatableButtonComponent) => button.minimunSelected > 0
            ).length > 0;
        } else {
            render = false;
        }
        if (this.multiCheck) {
            render = true;
        } else {
            render = false;
        }
        return render;
    }

    shouldRenderSingleCheckbox() {
        let render = false;
        if (this.singleCheck) {
            render = true;
        }
        return render;
    }

    _selectedRowsLength(): number {
        return this._parent.selectedRows().length;
    }

    _onFilter(event: any): void {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }

        this.filterTimeout = setTimeout(() => {
            this._parent._onFilter(event);
            this.filterTimeout = null;
        }, this.filterDelay);
    }

    ngAfterContentInit(): void {
        if (this.title && this.actionButtons.length > 0) {
            throw new Error('You must either define a title or action buttons to the datatable-header, not both');
        }
    }

    ngOnDestroy(): void {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
    }
}

@Component({
    selector: 'smd-datatable',
    templateUrl: './datatable.component.html',
    styleUrls: ['./datatable.component.scss'],
    encapsulation: ViewEncapsulation.None
    // host: {
    //     '[class.smd-responsive]': 'responsive'
    // }
})
export class SmdDataTableComponent implements DoCheck, AfterContentInit, OnDestroy, OnChanges, AfterViewChecked {

    visibleRows: SmdDataRowModel[] = [];
    private differ: any;
    private _columnsSubscription: Subscription;
    private searchValue: string;
    private columnTitleSearch: string;

    rows: SmdDataRowModel[] = [];

    @HostBinding('class.smd-responsive') get cRes() { return this.responsive; }

    @ViewChild(SmdPaginatorComponent) paginatorComponent: SmdPaginatorComponent;
    @ContentChild(SmdDatatableHeaderComponent) header: SmdDatatableHeaderComponent;
    @ContentChildren(SmdDataTableColumnComponent) columns: QueryList<SmdDataTableColumnComponent>;

    @Input() models: any[] = [];
    @Input() checked: boolean = false;
    @Input() paginated: boolean = true;
    @Input() paginatorRanges: number[] = [10, 25, 50, 100];
    @Input() responsive: boolean = false;
    @Input() noCaption: boolean = false;
    @Input() pageCount: number;
    @Input() clickable: boolean = false;
    @Input() disableCheckbox: boolean = false;

    @Output() clickFn: EventEmitter<any> = new EventEmitter();
    @Output() checkFn: EventEmitter<any> = new EventEmitter();
    @Output() pageFn: EventEmitter<any> = new EventEmitter();

    // tslint:disable-next-line:max-line-length
    @Output() onRowSelected: EventEmitter<{model: any, checked: boolean}> = new EventEmitter<{model: any, checked: boolean}>();
    @Output() onAllRowsSelected: EventEmitter<boolean> = new EventEmitter<boolean>();

    @Input() responsiveSearch: string;

    constructor(differs: IterableDiffers, public changeDetector: ChangeDetectorRef) {
        this.differ = differs.find([]).create(null);
    }

    get rowCount(): number {
        let count = this.rows.length;
        return count;
    }

    enableClick(): boolean {
      return this.clickable;
    }

    ngAfterContentInit() {
        this._updateRows();
        this._columnsSubscription = this.columns.changes.subscribe(() => {
            this._updateRows();
            this.changeDetector.markForCheck();
        });
        if (this.responsive) {
            let findSearchable = this.columns.filter(this.find);
            if (findSearchable.length > 0) {
                this.responsiveSearch = findSearchable[0].title;
            }
        }
    }

    find(item: SmdDataTableColumnComponent): boolean {
        return String(item.searchable) === 'true';
    }

    ngDoCheck(): void {
        let changes = this.differ.diff(this.models);
        if (changes) {
            if (this.columns) {
                this._updateRows();
            }
        }
    }

    ngOnDestory(): void {
      console.log('SmdDataTableComponent Destoryd');
    }

    ngOnChanges(): void {
        // let changes = this.differ.diff(this.models);
        // if (changes) {
        //     if (this.columns) {
        //         this._updateRows();
        //     }
        // }
    }

    ngAfterViewChecked(): void {
      this.changeDetector.detectChanges();
    }

    ngOnDestroy(): void {
        this._columnsSubscription.unsubscribe();
    }

    _updateRows() {
        if (this.models) {
            this.rows.length = 0;
            this.models.forEach((model: any, index: number) => this.rows[index] = new SmdDataRowModel(model, this.checked));
            let filterValue = this.searchValue || this.header.filterValue;
            this.rows = this.rows.filter((row: SmdDataRowModel) => this._matches(row, this.columns.toArray(), filterValue));
            this.rows.forEach((row, index) => row.originalOrder = index);
            this._updateVisibleRows();
        }
    }

    _matches(row: SmdDataRowModel, columns: SmdDataTableColumnComponent[], text: string): boolean {
        if (isNullOrUndefined(text) || text.trim() === '') {
            return true;
        }

        let subtexts: string[] = text.trim().split(' ');
        // let searchColumn = this.columnTitleSearch.toLowerCase();
        for (let subtext of subtexts) {
            for (let column of columns) {
                if (this.columnTitleSearch && text) {
                    if (column.title === this.columnTitleSearch) {
                        let value: any = column.getFieldValue(row.model);
                        value = String(value);
                        if (value.toLowerCase().indexOf(text.toLowerCase()) !== -1) {
                            this.paginatorComponent.reset();
                            return true;
                        }
                    }
                } else {
                    let filterFn = this._filterValue;
                    let value = column.getFieldValue(row.model);
                    if (column.hasCustomTemplate) {
                        value = row.model;
                        filterFn = column.filterFn ? column.filterFn : () => false;
                    }
                    if (filterFn(value, subtext)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _filterValue(value: any, text: string): boolean {
        return value && value.toString().toUpperCase().indexOf(text.toString().toUpperCase()) > -1;
    }

    selectedRows(): SmdDataRowModel[] {
        return this.rows.filter(row => row.checked);
    }

    selectedModels(): any[] {
        return this.selectedRows().map(row => row.model);
    }

    _onMasterCheckChange() {
        let rowsArray: Array<any> = [];
        this.rows
            .forEach(
                (row: SmdDataRowModel) => {
                    if (row.checked !== this.checked) {
                        row.checked = this.checked;
                    }
                    rowsArray.push(row.model);
                }
            );
        this.checkFn.emit({
            model: rowsArray,
            checked: this.checked
        });
        this.onAllRowsSelected.emit(this.checked);
    }

    _onSearchChange(e: string, title: string) {
        this.searchValue = e;
        this.columnTitleSearch = title;
        this._updateRows();
    }

    _onRowCheckChange(row: SmdDataRowModel) {
        let isMasterChecked = this.checked;
        if (row.checked) {
            // tslint:disable-next-line:no-shadowed-variable
            if (this.rows.filter((row) => row.checked).length === this.rows.length) {
                this.checked = true;
            }
        } else {
            if (this.checked) {
                this.checked = false;
            }
        }
        this.onRowSelected.emit({
            model: row.model,
            checked: row.checked
        });

        this.checkFn.emit({
            model: row.model,
            checked: row.checked
        });

        if (this.checked !== isMasterChecked) {
            this.onAllRowsSelected.emit(this.checked);
        }
    }

    _onFilter(event: any): void {
        this.paginatorComponent.reset();
        this._updateRows();
    }

    _sortColumn(column: SmdDataTableColumnComponent) {
        if (column.sortable) {
            this.columns.filter((col) => col.id !== column.id).forEach((col) => col.sortDir = null);

            if (!column.sortDir) {
                column.sortDir = 'asc';
            } else {
                column.sortDir = column.sortDir === 'asc' ? 'desc' : null;
            }

            if (column.sortDir != null) {
                this.rows.sort((itemA: SmdDataRowModel, itemB: SmdDataRowModel) => {
                    let sortFn = column.sortFn ? column.sortFn : this._sortRows;
                    let a = itemA.model;
                    let b = itemB.model;
                    if (!column.sortFn) {
                        a = column.getFieldValue(itemA.model);
                        b = column.getFieldValue(itemB.model);
                    }
                    return sortFn(a, b, column.sortDir);
                });
            } else {
                this.rows.sort((itemA: SmdDataRowModel, itemB: SmdDataRowModel) => {
                    return this._sortRows(itemA.originalOrder, itemB.originalOrder);
                });
            }
            this._updateVisibleRows();
        }
    }

    _sortRows(a: any, b: any, sortDir: string = 'asc') {
        let dir = (sortDir === 'asc' ? 1 : -1);
        if (a > b) {
            return 1 * dir;
        }
        if (a < b) {
            return -1 * dir;
        }
        return 0;
    }

    _onPageChange(event: MouseEvent) {
        this.pageFn.emit(event);
        this._updateVisibleRows();
    }

    _columnTemplates() {
        return this.columns.toArray().map((c) => c.template);
    }

    refresh() {
        this._updateRows();
    }

    private _updateVisibleRows() {
        if (this.paginated) {
            this.visibleRows = this.rows.filter(
                (value: SmdDataRowModel, index: number) => this.paginatorComponent.currentPage.isInsidePage(index));
        } else {
            this.visibleRows = this.rows;
        }
    }

    _shouldRenderCheckbox() {
        return this.rows.length > 0 && this.header.shouldRenderCheckbox();
    }

    _shouldRenderSingleCheckbox() {
        return this.rows.length > 0 && this.header.shouldRenderSingleCheckbox();
    }
}
