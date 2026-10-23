import { Component, input, output, signal, computed, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideCheck } from '@ng-icons/lucide';

export interface MultiSelectOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideCheck })],
  templateUrl: './multi-select.component.html',
  styleUrls: ['./multi-select.component.scss'],
})
export class MultiSelect {
  readonly allOptions = input.required<MultiSelectOption[]>();
  readonly selectedIds = input.required<number[]>();
  readonly placeholder = input<string>('Select options...');
  readonly selectedChange = output<number[]>();

  readonly selectedOptions = computed(() => {
    return this.allOptions().filter((option) => this.selectedIds().includes(option.id));
  });

  readonly dropdownOpen = signal(false);

  constructor() {
    afterNextRender(() => {
      const listener = () => this.closeDropdown();
      document.addEventListener('click', listener);
    });
  }

  toggleDropdown(event?: Event): void {
    event?.stopPropagation();
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  isOptionSelected(optionId: number): boolean {
    return this.selectedIds().includes(optionId);
  }

  toggleOption(optionId: number, event?: Event): void {
    event?.stopPropagation();
    const currentSelected = [...this.selectedIds()];
    const index = currentSelected.indexOf(optionId);
    if (index > -1) {
      currentSelected.splice(index, 1);
    } else {
      currentSelected.push(optionId);
    }
    this.selectedChange.emit(currentSelected);
  }

  getDisplayText(): string {
    const selected = this.selectedOptions();
    if (selected.length === 0) {
      return this.placeholder();
    }
    if (selected.length <= 2) {
      return selected.map((o) => o.label).join(', ');
    }
    return `${selected[0].label}, ${selected[1].label} +${selected.length - 2} more`;
  }
}