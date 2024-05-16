import { BaseType, select, Selection } from 'd3-selection';
import { ChartOptions, TreeNode } from './api';
import { max, min } from 'd3-array';
import 'd3-transition';
import { HierarchyPointNode } from 'd3-hierarchy';

type NodeEntry = {
  id: string;
  additionalMarriage?: boolean;
  width: number;
  height: number;
  anchor: [number, number]
}

export type GraphNode = {
  // Family ID when represents family, or
  // indi ID when represents single individual.
  id: string;

  indi?: NodeEntry; // husband
  spouse?: NodeEntry; // wife
  family?: NodeEntry;

  // Dimensions of the whole tree node for the purpose of laying out.
  width: number;
  height: number;

  x: number;
  y: number;

  // The generation number relative to the starting individual where negative
  // numbers are ancestors and positive numbers are descendants.
  generation: number;
}

export type GraphLink = {
  parentId: string
  childId: string
  childIndiSpouseId: string
}

type SVGSelection = Selection<BaseType, {}, BaseType, {}>;

/** Horizontal distance between boxes. */
export const H_SPACING = 15;
/** Vertical distance between boxes. */
export const V_SPACING = 30;
/** Margin around the whole drawing. */
const MARGIN = 15;

const HIDE_TIME_MS = 200;
const MOVE_TIME_MS = 500;

/**
 * Additional layout options intended to be used internally by layout
 * implementations.
 */
export interface LayoutOptions {
  flipVertically?: boolean;
  vSpacing?: number;
  hSpacing?: number;
}

export interface ChartSizeInfo {
  // Chart size.
  size: [number, number];
  // The coordinates of the start indi or fam.
  origin: [number, number];
}

/** Assigns an identifier to a link. */
export function linkId(link: GraphLink) {
  return `${link.parentId}:${link.childId}`;
}

export function getChartInfo(
  nodes: Array<GraphNode>
): ChartSizeInfo {
  // Calculate chart boundaries.
  const x0 = min(nodes, (d) => d.x - d.width! / 2)! - MARGIN;
  const y0 = min(nodes, (d) => d.y - d.height! / 2)! - MARGIN;
  const x1 = max(nodes, (d) => d.x + d.width! / 2)! + MARGIN;
  const y1 = max(nodes, (d) => d.y + d.height! / 2)! + MARGIN;
  return { size: [x1 - x0, y1 - y0], origin: [-x0, -y0] };
}

/** Utility class with common code for all chart types. */
export class DagUtil {
  constructor(readonly options: ChartOptions) {}

  /** Creates a path from parent to the child node (vertical layout). */
  private linkVertical(
    s: GraphNode,
    d: GraphNode,
    link: GraphLink,
  ) {
    const sAnchor = s.family!.anchor
    const dAnchor = link.childIndiSpouseId === d.indi?.id ? d.indi.anchor : link.childIndiSpouseId === d.spouse?.id ? d.spouse.anchor : null
    if(!sAnchor || !dAnchor) {
      console.error('get anchor error', link)
      return ''
    }
    const [sx, sy] = [s.x + sAnchor[0], s.y + sAnchor[1]];
    const [dx, dy] = [d.x + dAnchor[0], d.y + dAnchor[1]];
    const midY = s.y + s.height! / 2 + V_SPACING / 2;
    return `M ${sx} ${sy}
            L ${sx} ${midY},
              ${dx} ${midY},
              ${dx} ${dy}`;
  }

  // private linkAdditionalMarriage(node: GraphNode) {
  //   const nodeIndex = node.parent!.children!.findIndex(
  //     (n) => n.data.id === node.data.id
  //   );
  //   // Assert nodeIndex > 0.
  //   const siblingNode = node.parent!.children![nodeIndex - 1];
  //   const sAnchor = this.options.renderer.getIndiAnchor(node.data);
  //   const dAnchor = this.options.renderer.getIndiAnchor(siblingNode.data);
  //   const [sx, sy] = [node.x + sAnchor[0], node.y + sAnchor[1]];
  //   const [dx, dy] = [siblingNode.x + dAnchor[0], siblingNode.y + dAnchor[1]];
  //   return `M ${sx}, ${sy}
  //           L ${dx}, ${dy}`;
  // }

  updateSvgDimensions(chartInfo: ChartSizeInfo) {
    const svg = select(this.options.svgSelector);
    const group = svg.select('g');
    const transition = this.options.animate
      ? group.transition().delay(HIDE_TIME_MS).duration(MOVE_TIME_MS)
      : group;
    transition.attr(
      'transform',
      `translate(${chartInfo.origin[0]}, ${chartInfo.origin[1]})`
    );
  }

  renderChart(nodes: Array<GraphNode>, links: Array<GraphLink>): Promise<void> {
    const svg = this.getSvgForRendering();
    const nodeAnimation = this.renderNodes(nodes, svg);
    const linkAnimation = this.renderLinks(nodes, links, svg);
    return Promise.all([
      nodeAnimation,
      linkAnimation,
    ]) as unknown as Promise<void>;
  }

  renderNodes(
    nodes: Array<GraphNode>,
    svg: SVGSelection
  ): Promise<void> {

    const formattedNodes: HierarchyPointNode<TreeNode>[] = nodes.map(n => ({
      data: {
        id: n.id,
        indi: n.indi ? {
          id: n.indi.id,
          width: n.indi.width,
          height: n.indi.height,
        } : undefined,
        spouse: n.spouse ? {
          id: n.spouse.id,
          width: n.spouse.width,
          height: n.spouse.height,
        } : undefined,
        family: n.family ? {
          id: n.family.id,
          width: n.family.width,
          height: n.family.height,
        } : undefined,
        width: n.width,
        height: n.height,
        generation: n.generation,
      },
      id: n.id,
      depth: n.generation,
      height: n.height,
      x: n.x,
      y: n.y,
    } as HierarchyPointNode<TreeNode>))

    console.log('formattedNodes --------->', formattedNodes)

    const animationPromise = new Promise<void>((resolve) => {
      const boundNodes = svg
        .select('g')
        .selectAll('g.node')
        .data(formattedNodes, (d: HierarchyPointNode<TreeNode>) => d.id!);

      const nodeEnter = boundNodes.enter().append('g' as string);

      let transitionsPending =
        boundNodes.exit().size() + boundNodes.size() + nodeEnter.size();
      const transitionDone = () => {
        transitionsPending--;
        if (transitionsPending === 0) {
          resolve();
        }
      };
      if (!this.options.animate || transitionsPending === 0) {
        resolve();
      }

      nodeEnter
        .merge(boundNodes)
        .attr('class', (node) => `node generation${node.data.generation}`);
      nodeEnter.attr(
        'transform',
        (node: HierarchyPointNode<TreeNode>) =>
          `translate(${node.x - node.data.width! / 2}, ${
            node.y - node.data.height! / 2
          })`
      );
      if (this.options.animate) {
        nodeEnter
          .style('opacity', 0)
          .transition()
          .delay(HIDE_TIME_MS + MOVE_TIME_MS)
          .duration(HIDE_TIME_MS)
          .style('opacity', 1)
          .on('end', transitionDone);
      }
      const updateTransition = this.options.animate
        ? boundNodes
            .transition()
            .delay(HIDE_TIME_MS)
            .duration(MOVE_TIME_MS)
            .on('end', transitionDone)
        : boundNodes;
      updateTransition.attr(
        'transform',
        (node: HierarchyPointNode<TreeNode>) =>
          `translate(${node.x - node.data.width! / 2}, ${
            node.y - node.data.height! / 2
          })`
      );
      this.options.renderer.render(nodeEnter, boundNodes);
      if (this.options.animate) {
        boundNodes
          .exit()
          .transition()
          .duration(HIDE_TIME_MS)
          .style('opacity', 0)
          .remove()
          .on('end', transitionDone);
      } else {
        boundNodes.exit().remove();
      }
    });
    return animationPromise;
  }

  renderLinks(
    nodes: Array<GraphNode>, 
    links: Array<GraphLink>,
    svg: SVGSelection
  ): Promise<void> {
    const animationPromise = new Promise<void>((resolve) => {
      const link = (
        parent: GraphNode,
        child: GraphNode,
        lk: GraphLink,
      ) => {
        // if (child.data.additionalMarriage) {
        //   return this.linkAdditionalMarriage(child);
        // }
        return this.linkVertical(parent, child, lk);
      };

      // const links = nodes.filter(
      //   (n) => n. !!n.parent || n.data.additionalMarriage
      // );
      const boundLinks = svg
        .select('g')
        .selectAll('path.link')
        .data(links, linkId);
      const path = boundLinks
        .enter()
        .insert('path', 'g')
        .attr('class', () =>
          // node.data.additionalMarriage ? 'link additional-marriage' : 'link'
          'link'
        )
        .attr('d', (lk) => {
          const parent = nodes.find(n => n.id === lk.parentId)!
          const child = nodes.find(n => n.id === lk.childId)!
          return link(parent, child, lk)
        });

      let transitionsPending =
        boundLinks.exit().size() + boundLinks.size() + path.size();
      const transitionDone = () => {
        transitionsPending--;
        if (transitionsPending === 0) {
          resolve();
        }
      };
      if (!this.options.animate || transitionsPending === 0) {
        resolve();
      }

      const linkTransition = this.options.animate
        ? boundLinks
            .transition()
            .delay(HIDE_TIME_MS)
            .duration(MOVE_TIME_MS)
            .on('end', transitionDone)
        : boundLinks;
      linkTransition.attr('d', (lk) => {
        const parent = nodes.find(n => n.id === lk.parentId)!
        const child = nodes.find(n => n.id === lk.childId)!
        return link(parent, child, lk)
      });

      if (this.options.animate) {
        path
          .style('opacity', 0)
          .transition()
          .delay(2 * HIDE_TIME_MS + MOVE_TIME_MS)
          .duration(0)
          .style('opacity', 1)
          .on('end', transitionDone);
      }
      if (this.options.animate) {
        boundLinks
          .exit()
          .transition()
          .duration(0)
          .style('opacity', 0)
          .remove()
          .on('end', transitionDone);
      } else {
        boundLinks.exit().remove();
      }
    });
    return animationPromise;
  }

  getSvgForRendering(): SVGSelection {
    const svg = select(this.options.svgSelector) as SVGSelection;
    if (svg.select('g').empty()) {
      svg.append('g');
    }
    return svg;
  }
}
