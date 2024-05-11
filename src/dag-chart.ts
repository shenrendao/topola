import { BaseType, select, Selection } from 'd3-selection';
import { HierarchyNode, HierarchyPointNode, stratify } from 'd3-hierarchy';
import { max, min } from 'd3-array';
import { getAncestorsTree } from './ancestor-chart';
import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api';
import { ChartUtil, LayoutOptions, getChartInfo } from './chart-util';
import { layOutDescendants } from './descendant-chart';
import { DetailedRenderer } from '.';
import { Graph, graphStratify, sugiyama } from 'd3-dag';


export class DagChart<IndiT extends Indi, FamT extends Fam>
  implements Chart
{
  readonly util: ChartUtil;

  constructor(readonly options: ChartOptions) {
    this.util = new ChartUtil(options);
  }

  render(): ChartInfo {

    console.log('options --------->', this.options)

    const indiMap = this.options.data.getIndis()
    const indis = Array.from(indiMap.values())
    const famMap = this.options.data.getFams()
    const fams = Array.from(famMap.values())

    ;(() => {
      indis.forEach(indi => {
        indi.getFamiliesAsSpouse().forEach(fid => {
          const family = famMap.get(fid)
          if(!family) {
            console.warn('not exist family 111 ------------>', fid, indi.getId())
            return
          }
          if(family.getFather() !== indi.getId() && family.getMother() !== indi.getId()) {
            console.warn('family father or mother not match ---------->', indi.getId(), family.getId(), family.getFather(), family.getMother())
          }
        })
        const fid = indi.getFamilyAsChild()
        if(!fid) {
          // console.warn('without origin family -------->', fid, indi.getId())
          return
        }
        const family = famMap.get(fid)
        if(!family) {
          console.warn('not exist family 222 ------------>', fid, indi.getId())
          return
        }
        if(!family.getChildren().includes(indi.getId())) {
          console.warn('family child missing --------->', indi.getId(), family.getId(), family.getChildren())
        }
      })

      fams.forEach(fam => {
        const fid = fam.getId()
        const father = fam.getFather()
        if(father) {
          const indi = indiMap.get(father)
          if(!indi) {
            console.warn('father not exists --------------->', father, fid)
            return
          }
          const fatherFamilies = indi.getFamiliesAsSpouse()
          if(!fatherFamilies.includes(fid)) {
            console.warn('father families missing --------------->', father, fid)
            return
          }
        }
        const mother = fam.getMother()
        if(mother) {
          const indi = indiMap.get(mother)
          if(!indi) {
            console.warn('mother not exists --------------->', mother, fid)
            return
          }
          const motherFamilies = indi.getFamiliesAsSpouse()
          if(!motherFamilies.includes(fid)) {
            console.warn('mother families missing --------------->', mother, fid)
            return
          }
        }
        if(!father && !mother) {
          console.warn('family without father and mother ----------->', fid)
          return
        }
        fam.getChildren().forEach(child => {
          const indi = indiMap.get(child)
          if(!indi) {
            console.warn('child not exists --------------->', child, fid)
            return
          }
          if(indi.getFamilyAsChild() !== fid) {
            console.warn('child family not match ------------->', child, indi.getFamilyAsChild(), fid)
            return
          }
        })
      })

    })()

    fams.forEach(fam => {
      const fid = fam.getId()
      const father = fam.getFather()
      const mother = fam.getMother()
      const children = fam.getChildren()
      if(father) {
        const indi = indiMap.get(father)
        if(indi) {
          const fs = indi.getFamiliesAsSpouse()
          if(!fs.includes(fid)) {
            indi.setFamiliesAsSpouse([...fs, fid])
          }
        }
      }
      if(mother) {
        const indi = indiMap.get(mother)
        if(indi) {
          const fs = indi.getFamiliesAsSpouse()
          if(!fs.includes(fid)) {
            indi.setFamiliesAsSpouse([...fs, fid])
          }
        }
      }
      children.forEach(child => {
        const indi = indiMap.get(child)
        if(indi) {
          const fc = indi.getFamilyAsChild()
          if(fc !== fid) {
            indi.setFamilyAsChild(fid)
          }
        }
      })
    })
    
    const treeMap = indis.reduce((m, indi)=>{
      this.getNodes(indi.getId(), indiMap).forEach(n => {
        m.set(n.id, n)
      })
      return m
    }, new Map<string, TreeNode>);
    const treeNodes = Array.from(treeMap.values());

    console.log('treeNodes ----------->', treeNodes)
    
    const reverseMap = treeNodes.reduce((m, indi) => {
      m.set(indi.id, {id: indi.id, parentIds: []})
      return m
    }, new Map<string, {id: string; parentIds: string[]}>());

    fams.forEach(f => {
      f.getChildren().forEach(c => {
        const n = reverseMap.get(c)
        if(n) {
          n.parentIds = [...n.parentIds, f.getId()]
          return
        }
        const indi = indiMap.get(c)
        indi?.getFamiliesAsSpouse().forEach(fid => {
          const familyNode = treeMap.get(fid)
          if(familyNode && !familyNode.additionalMarriage) {
            const nn = reverseMap.get(fid)
            if(nn) {
              nn.parentIds = [...nn.parentIds, f.getId()]
            }
          }
        })
      })
    });

    // indis.forEach(i => {
    //   const parent = i.getFamilyAsChild()
    //   if(parent) {
    //     const n = reverseMap.get(i.getId())
    //     if(n && !n.parentIds.includes(parent)) {
    //       n.parentIds = [...n.parentIds, parent]
    //     }
    //   }
    // })

    const data = Array.from(reverseMap.values());
    console.log('data ----------->', data)

    treeNodes.forEach(n => {
      if(n.family?.id) {
        const [width, height]= (this.options.renderer as DetailedRenderer).getPreferredFamSize(n.family.id);
        n.family.width = width
        n.family.height = height
      }
      if(n.indi?.id) {
        const [width, height]= (this.options.renderer as DetailedRenderer).getPreferredIndiSize(n.indi.id);
        n.indi.width = width
        n.indi.height = height
      }
      if(n.spouse?.id) {
        const [width, height]= (this.options.renderer as DetailedRenderer).getPreferredIndiSize(n.spouse.id);
        n.spouse.width = width
        n.spouse.height = height
      }
      n.width = Math.max(n.family?.width ?? 0, (n.indi?.width ?? 0) + (n.spouse?.width ?? 0))
      n.height = (n.family?.height ?? 0) + Math.max((n.indi?.width ?? 0), (n.spouse?.width ?? 0))
    });

    console.log('treeNodes --------->', treeNodes);
    


    const builder = graphStratify();
    const graph = builder(data);
    const layout = sugiyama()
    //.layering(d3dag.layeringLongestPath())
    //.decross(d3dag.decrossOpt())
    //.coord(d3dag.coordGreedy())
    //.coord(d3dag.coordQuad())
      .nodeSize((n: {data: {id: string; parentIds: string[]}}) => {
        const nodeWithSize = treeNodes.find(treeNode => treeNode.id === n.data.id)
        if(nodeWithSize) {
          const { width, height }=nodeWithSize;
          return [width ?? 20, height ?? 20];
        }
        return [20, 20]
      })
      .gap([15, 30]);
    const { width, height } = layout(graph as unknown as Graph<never, never>);
    const dagNodes = Array.from(graph.nodes());
    console.log('dagNodes ---------->', dagNodes);

    const yArray = Array.from(dagNodes.reduce((s, n) => {
      s.add(n.y)
      return s
    }, new Set<number>())).sort((a, b) => {
      return a - b
    })

    console.log('yArray ----------->', yArray)


    const nodeMap = dagNodes.reduce((m, n) => {
      const node = {
        data: treeNodes.find(treeNode => treeNode.id === n.data.id),
        depth: yArray.indexOf(n.y),
        height: 50,
        id: n.data.id,
        x: n.x,
        y: n.y,
        children: [] as HierarchyPointNode<TreeNode>[],
      } as HierarchyPointNode<TreeNode>
      m.set(n.data.id, node)
      return m
    }, new Map<string, HierarchyPointNode<TreeNode>>())
    const nodeArray = Array.from(nodeMap.values())

    data.forEach(item => {
      const childId = item.id
      const child = nodeMap.get(childId)
      item.parentIds.forEach(parentId => {
        const parent = nodeMap.get(parentId)
        if(child && parent) {
          child.parent = parent
          parent.children?.push(child)
        }
      })
    })

    console.log('nodeArray ------------>', nodeArray)

    const animationPromise = this.util.renderChart(nodeArray);
    const info = getChartInfo(nodeArray);

    

    const descendantNodes = layOutDescendants({...this.options, svgSelector: '#hourglass'});

    console.log('descendantNodes --------->', descendantNodes)


    const nodes = descendantNodes;
    // const animationPromise = this.util.renderChart(nodes);

    // const info = getChartInfo(nodes);
    this.util.updateSvgDimensions(info);
    return Object.assign(info, { animationPromise });
  }

  private getNodes(indiId: string, indiMap: Map<string, Indi>): TreeNode[] {
    const indi = this.options.data.getIndi(indiId)!;
    const famIds = indi.getFamiliesAsSpouse();
    if (!famIds.length) {
      // Single person.
      return [
        {
          id: indiId,
          indi: {
            id: indiId,
          },
        },
      ];
    }
    // Marriages.
    const nodes = famIds.map((famId) => {
      const entry: TreeNode = {
        id: famId,
        indi: {
          id: indiId,
        },
        family: {
          id: famId,
        },
      };
      const fam = this.options.data.getFam(famId)!;
      const spouse = fam.getFather() === indiId ? fam.getMother() : fam.getFather();
      if (spouse) {
        entry.spouse = { id: spouse };
      }

      entry.indiParentNodeId = (entry.indi?.id ? indiMap.get(entry.indi.id)?.getFamilyAsChild() : undefined) || undefined
      entry.spouseParentNodeId = (entry.spouse?.id ? indiMap.get(entry.spouse.id)?.getFamilyAsChild() : undefined) || undefined

      return entry;
    });
    // nodes.slice(1).forEach((node) => {
    //   node.additionalMarriage = true;
    // });
    return nodes;
  }
  
  
}

