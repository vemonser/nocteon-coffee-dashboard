import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar } from '@ng-icons/lucide';
@Component({ selector:'app-rating-stars', standalone:true, imports:[NgIcon], providers:[provideIcons({lucideStar})], template:`<span class="inline-flex items-center gap-2" [attr.aria-label]="rating() + ' / ' + max()">@for (i of stars; track i) { <ng-icon name="lucideStar" class="size-4" [class.text-warning]="i <= rating()" [class.text-muted-foreground]="i > rating()" [class.fill-warning]="i <= rating()" /> } @if (showText()) { <span class="ms-2 min-w-[2.5rem] text-xs tabular-nums text-muted-foreground">{{ rating() }}/{{ max() }}</span> }</span>` })
export class RatingStarsComponent { readonly rating = input<number>(0); readonly max = input<number>(5); readonly showText = input<boolean>(false); readonly stars = [1,2,3,4,5]; }
