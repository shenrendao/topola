import { ChartColors } from '.';
import { Chart, ChartInfo, ChartOptions, FamInfo, IndiInfo, Renderer, RendererOptions } from './api';
import { FamDetails, IndiDetails, JsonGedcomData } from './data';
export interface ChartType {
    new (options: ChartOptions): Chart;
}
export interface RendererType {
    new (options: RendererOptions<IndiDetails, FamDetails>): Renderer;
}
/** Options when rendering or rerendering a chart. */
export interface RenderOptions {
    startIndi?: string;
    startFam?: string;
    baseGeneration?: number;
}
/** Options when initializing a chart. */
export interface SimpleChartOptions {
    json: JsonGedcomData;
    indiUrl?: string;
    famUrl?: string;
    indiCallback?: (id: IndiInfo) => void;
    famCallback?: (id: FamInfo) => void;
    svgSelector?: string;
    chartType: ChartType;
    renderer: RendererType;
    horizontal?: boolean;
    colors?: ChartColors;
    animate?: boolean;
    updateSvgSize?: boolean;
    locale?: string;
}
export interface ChartHandle {
    render(data?: RenderOptions): ChartInfo;
    setData(json: JsonGedcomData): void;
}
export declare function createChart(options: SimpleChartOptions): ChartHandle;
