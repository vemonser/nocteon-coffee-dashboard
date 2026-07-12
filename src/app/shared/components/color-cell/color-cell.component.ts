import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-color-cell',
  imports: [CommonModule],
  templateUrl: './color-cell.component.html',
})
export class ColorCellComponent {
  color = input.required<string>();
  ngOnInit(){
    console.log(this.color())
  }
}
