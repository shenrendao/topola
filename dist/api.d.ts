import { BaseType, Selection } from 'd3-selection';
import { HierarchyNode, HierarchyPointNode } from 'd3-hierarchy';
/** Individual or family ID with dimensions. */
export interface TreeEntry {
    id: string;
    width?: number;
    height?: number;
}
/** Represents a node in the d3 graph structure. */
export interface TreeNode {
    id: string;
    parentId?: string;
    indi?: TreeEntry;
    spouse?: TreeEntry;
    family?: TreeEntry;
    width?: number;
    height?: number;
    generation?: number;
    indiParentNodeId?: string;
    spouseParentNodeId?: string;
    additionalMarriage?: boolean;
}
/**
 * Interface for an individual.
 * This interface is only used in the context of creating the layout.
 */
export interface Indi {
    getId(): string;
    getFamiliesAsSpouse(): string[];
    getFamilyAsChild(): string | null;
}
/**
 * Interface for a family.
 * This interface is only used in the context of creating the layout.
 */
export interface Fam {
    getId(): string;
    getFather(): string | null;
    getMother(): string | null;
    getChildren(): string[];
}
/** Data provider backed up by a data structure. */
export interface DataProvider<IndiT extends Indi, FamT extends Fam> {
    getIndi(id: string): IndiT | null;
    getFam(id: string): FamT | null;
}
/** D3 selection containing TreeNode data. */
export declare type TreeNodeSelection = Selection<BaseType, HierarchyPointNode<TreeNode>, BaseType, {}>;
/** Interface for rendering data. */
export interface Renderer {
    render(enter: TreeNodeSelection, update: TreeNodeSelection): void;
    getCss(): string;
    updateNodes(nodes: Array<HierarchyNode<TreeNode>>): void;
    getFamilyAnchor(node: TreeNode): [number, number];
    getIndiAnchor(node: TreeNode): [number, number];
    getSpouseAnchor(node: TreeNode): [number, number];
}
export interface IndiInfo {
    id: string;
    generation: number;
}
export interface FamInfo {
    id: string;
    generation: number;
}
export declare enum ChartColors {
    NO_COLOR = 0,
    COLOR_BY_GENERATION = 1,
    COLOR_BY_SEX = 2
}
export interface RendererOptions<IndiT extends Indi, FamT extends Fam> {
    indiHrefFunc?: (id: string) => string;
    famHrefFunc?: (id: string) => string;
    indiCallback?: (id: IndiInfo) => void;
    famCallback?: (id: FamInfo) => void;
    data: DataProvider<IndiT, FamT>;
    horizontal?: boolean;
    colors?: ChartColors;
    animate?: boolean;
    locale?: string;
}
export interface ChartInfo {
    size: [number, number];
    origin: [number, number];
    animationPromise: Promise<void>;
}
export interface Chart {
    render(): ChartInfo;
}
export interface ChartOptions {
    data: DataProvider<Indi, Fam>;
    renderer: Renderer;
    svgSelector: string;
    startIndi?: string;
    startFam?: string;
    swapStartSpouses?: boolean;
    horizontal?: boolean;
    baseGeneration?: number;
    animate?: boolean;
    idGenerator?: {
        getId: (id: string) => string;
    };
}
