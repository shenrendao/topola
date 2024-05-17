import { select } from 'd3-selection'
import { max } from 'd3-array'
import { Chart, ChartInfo, ChartOptions, Fam, Indi, TreeNode } from './api'
import { DetailedRenderer } from '.'
import { Graph, graphStratify, sugiyama } from 'd3-dag'
import { DagUtil, GraphLink, GraphNode, getChartInfo } from './dag-util'

export class DagChart<IndiT extends Indi, FamT extends Fam> implements Chart {
  readonly util: DagUtil

  constructor(readonly options: ChartOptions) {
    this.util = new DagUtil(options)
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
          if (!family) {
            console.warn('not exist family 111 ------------>', fid, indi.getId())
            return
          }
          if (family.getFather() !== indi.getId() && family.getMother() !== indi.getId()) {
            console.warn(
              'family father or mother not match ---------->',
              indi.getId(),
              family.getId(),
              family.getFather(),
              family.getMother(),
            )
          }
        })
        const fid = indi.getFamilyAsChild()
        if (!fid) {
          // console.warn('without origin family -------->', fid, indi.getId())
          return
        }
        const family = famMap.get(fid)
        if (!family) {
          console.warn('not exist family 222 ------------>', fid, indi.getId())
          return
        }
        if (!family.getChildren().includes(indi.getId())) {
          console.warn('family child missing --------->', indi.getId(), family.getId(), family.getChildren())
        }
      })

      fams.forEach(fam => {
        const fid = fam.getId()
        const father = fam.getFather()
        if (father) {
          const indi = indiMap.get(father)
          if (!indi) {
            console.warn('father not exists --------------->', father, fid)
            return
          }
          const fatherFamilies = indi.getFamiliesAsSpouse()
          if (!fatherFamilies.includes(fid)) {
            console.warn('father families missing --------------->', father, fid)
            return
          }
        }
        const mother = fam.getMother()
        if (mother) {
          const indi = indiMap.get(mother)
          if (!indi) {
            console.warn('mother not exists --------------->', mother, fid)
            return
          }
          const motherFamilies = indi.getFamiliesAsSpouse()
          if (!motherFamilies.includes(fid)) {
            console.warn('mother families missing --------------->', mother, fid)
            return
          }
        }
        if (!father && !mother) {
          console.warn('family without father and mother ----------->', fid)
          return
        }
        fam.getChildren().forEach(child => {
          const indi = indiMap.get(child)
          if (!indi) {
            console.warn('child not exists --------------->', child, fid)
            return
          }
          if (indi.getFamilyAsChild() !== fid) {
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
      if (father) {
        const indi = indiMap.get(father)
        if (indi) {
          const fs = indi.getFamiliesAsSpouse()
          if (!fs.includes(fid)) {
            indi.setFamiliesAsSpouse([...fs, fid])
          }
        }
      }
      if (mother) {
        const indi = indiMap.get(mother)
        if (indi) {
          const fs = indi.getFamiliesAsSpouse()
          if (!fs.includes(fid)) {
            indi.setFamiliesAsSpouse([...fs, fid])
          }
        }
      }
      children.forEach(child => {
        const indi = indiMap.get(child)
        if (indi) {
          const fc = indi.getFamilyAsChild()
          if (fc !== fid) {
            indi.setFamilyAsChild(fid)
          }
        }
      })
    })

    const treeMap = indis.reduce((m, indi) => {
      this.getNodes(indi.getId(), indiMap).forEach(n => {
        m.set(n.id, n)
      })
      return m
    }, new Map<string, TreeNode>())
    const treeNodes = Array.from(treeMap.values())

    console.log('treeNodes ----------->', treeNodes)

    const reverseMap = treeNodes.reduce((m, indi) => {
      m.set(indi.id, { id: indi.id, parentIds: [] })
      return m
    }, new Map<string, { id: string; parentIds: string[] }>())

    fams.forEach(f => {
      f.getChildren().forEach(c => {
        const n = reverseMap.get(c)
        if (n) {
          n.parentIds = [...n.parentIds, f.getId()]
          return
        }
        const indi = indiMap.get(c)
        indi?.getFamiliesAsSpouse().forEach(fid => {
          const familyNode = treeMap.get(fid)
          if (familyNode && !familyNode.additionalMarriage) {
            const nn = reverseMap.get(fid)
            if (nn) {
              nn.parentIds = [...nn.parentIds, f.getId()]
            }
          }
        })
      })
    })

    // indis.forEach(i => {
    //   const parent = i.getFamilyAsChild()
    //   if(parent) {
    //     const n = reverseMap.get(i.getId())
    //     if(n && !n.parentIds.includes(parent)) {
    //       n.parentIds = [...n.parentIds, parent]
    //     }
    //   }
    // })
    const links: GraphLink[] = []
    fams.forEach(f => {
      f.getChildren().forEach(c => {
        const indi = indiMap.get(c)
        if (indi) {
          links.push(
            ...indi.getFamiliesAsSpouse().map(familyAsSpouse => ({
              parentId: f.getId(),
              childId: familyAsSpouse,
              childIndiSpouseId: c,
            })),
          )
          const node = treeMap.get(indi.getId())
          if (node) {
            links.push({
              parentId: f.getId(),
              childId: node.id,
              childIndiSpouseId: node.id,
            })
          }
        }
      })
    })
    console.log('links -------->', links)

    const data = Array.from(reverseMap.values())
    console.log('data ----------->', data)

    treeNodes.forEach(n => {
      if (n.family?.id) {
        const [width, height] = (this.options.renderer as DetailedRenderer).getPreferredFamSize(n.family.id)
        n.family.width = width
        n.family.height = height
      }
      if (n.indi?.id) {
        const [width, height] = (this.options.renderer as DetailedRenderer).getPreferredIndiSize(n.indi.id)
        n.indi.width = width
        n.indi.height = height
      }
      if (n.spouse?.id) {
        const [width, height] = (this.options.renderer as DetailedRenderer).getPreferredIndiSize(n.spouse.id)
        n.spouse.width = width
        n.spouse.height = height
        if (n.indi && (n.indi.height ?? 0) < height) {
          n.indi.height = height
        }
        if (n.indi && (n.indi.height ?? 0) > height) {
          n.spouse.height = n.indi.height
        }
      }
      n.width = Math.max(n.family?.width ?? 0, (n.indi?.width ?? 0) + (n.spouse?.width ?? 0))
      n.height = (n.family?.height ?? 0) + Math.max(n.indi?.height ?? 0, n.spouse?.height ?? 0)
    })

    console.log('treeNodes --------->', treeNodes)

    // treeNodes.forEach(n => {
    //   console.log(`size ${n.id} ${n.width} ${n.height}`)
    // })

    const builder = graphStratify()
    const graph = builder(data)
    const layout = sugiyama()
      //.layering(d3dag.layeringLongestPath())
      //.decross(d3dag.decrossOpt())
      //.coord(d3dag.coordGreedy())
      //.coord(d3dag.coordQuad())
      .nodeSize((n: { data: { id: string; parentIds: string[] } }) => {
        const nodeWithSize = treeNodes.find(treeNode => treeNode.id === n.data.id)
        if (nodeWithSize) {
          const { width, height } = nodeWithSize
          return [width ?? 20, height ?? 20]
        }
        return [20, 20]
      })
      .gap([15, 30])
    const { width, height } = layout(graph as unknown as Graph<never, never>)
    const dagNodes = Array.from(graph.nodes())
    console.log('dagNodes ---------->', dagNodes)

    const yArray = Array.from(
      dagNodes.reduce((s, n) => {
        s.add(n.y)
        return s
      }, new Set<number>()),
    ).sort((a, b) => {
      return a - b
    })

    console.log('yArray ----------->', yArray)

    const nodeMap = dagNodes.reduce((m, n) => {
      const tn = treeMap.get(n.data.id)
      const dn = dagNodes.find(dagNode => dagNode.data.id === n.data.id)
      if (!tn || !dn) {
        return m
      }
      // treeNode.indi
      const node: GraphNode = {
        id: tn.id,
        indi: tn.indi
          ? {
              id: tn.indi.id,
              width: tn.indi.width!,
              height: tn.indi.height!,
              anchor: [0, 0],
            }
          : undefined,
        spouse: tn.spouse
          ? {
              id: tn.spouse.id,
              width: tn.spouse.width!,
              height: tn.spouse.height!,
              anchor: [0, 0],
            }
          : undefined,
        family: tn.family
          ? {
              id: tn.family.id,
              width: tn.family.width!,
              height: tn.family.height!,
              anchor: [0, 0],
            }
          : undefined,
        width: tn.width!,
        height: tn.height!,
        x: dn.x,
        y: dn.y,
        generation: yArray.indexOf(n.y),
      }
      m.set(n.data.id, node)
      return m
    }, new Map<string, GraphNode>())
    const nodeArray = Array.from(nodeMap.values()).map(n => {
      if (n.indi) {
        n.indi.anchor = getIndiAnchor(n)
      }
      if (n.spouse) {
        n.spouse.anchor = getSpouseAnchor(n)
      }
      if (n.family) {
        n.family.anchor = getFamilyAnchor(n)
      }

      return n
    })

    // data.forEach(item => {
    //   const childId = item.id
    //   const child = nodeMap.get(childId)
    //   item.parentIds.forEach(parentId => {
    //     const parent = nodeMap.get(parentId)
    //     if(child && parent) {
    //       child.parent = parent
    //       parent.children?.push(child)
    //     }
    //   })
    // })

    console.log('nodeArray ------------>', nodeArray)

    const svg = select(this.options.svgSelector)
    if (svg.select('style').empty()) {
      svg.append('style').text(this.options.renderer.getCss())
    }

    const animationPromise = this.util.renderChart(nodeArray, links)
    const info = getChartInfo(nodeArray)
    this.util.updateSvgDimensions(info)
    return Object.assign(info, { animationPromise })
  }

  private getNodes(indiId: string, indiMap: Map<string, Indi>): TreeNode[] {
    const indi = this.options.data.getIndi(indiId)!
    const famIds = indi.getFamiliesAsSpouse()
    if (!famIds.length) {
      // Single person.
      return [
        {
          id: indiId,
          indi: {
            id: indiId,
          },
        },
      ]
    }
    // Marriages.
    const nodes = famIds.map(famId => {
      const fam = this.options.data.getFam(famId)!
      const entry: TreeNode = {
        id: famId,
        indi: fam.getFather()
          ? {
              id: fam.getFather()!,
            }
          : undefined,
        spouse: fam.getMother()
          ? {
              id: fam.getMother()!,
            }
          : undefined,
        family: {
          id: famId,
        },
        indiParentNodeId:
          (fam.getFather() ? indiMap.get(fam.getFather()!)?.getFamilyAsChild() : undefined) || undefined,
        spouseParentNodeId:
          (fam.getMother() ? indiMap.get(fam.getMother()!)?.getFamilyAsChild() : undefined) || undefined,
      }
      return entry
    })
    // nodes.slice(1).forEach((node) => {
    //   node.additionalMarriage = true;
    // });
    return nodes
  }
}

const getFamilyAnchor = (node: GraphNode): [number, number] => {
  const famXOffset = node.family ? max([-getFamPositionVertical(node), 0]) : 0
  const x = -(node.indi && node.spouse ? node.width! / 2 - node.indi.width! : 0) + famXOffset!
  const y = -node.height! / 2 + getIndiVSize(node) / 2
  return [x, y]
}

const getSpouseAnchor = (node: GraphNode): [number, number] => {
  const x = node.indi ? node.indi.width! / 2 : 0
  const y = -node.height! / 2 + getIndiVSize(node) / 2
  return [x, y]
}

const getIndiAnchor = (node: GraphNode): [number, number] => {
  const x = node.spouse ? -node.spouse.width! / 2 : 0
  const y = -node.height! / 2 + getIndiVSize(node) / 2
  return [x, y]
}

function getFamPositionVertical(node: GraphNode): number {
  const indiWidth = node.indi ? node.indi.width! : 0
  const spouseWidth = node.spouse ? node.spouse.width! : 0
  const familyWidth = node.family!.width!
  if (!node.indi || !node.spouse || indiWidth + spouseWidth <= familyWidth) {
    return (indiWidth + spouseWidth - familyWidth) / 2
  }
  if (familyWidth / 2 >= spouseWidth) {
    return indiWidth + spouseWidth - familyWidth
  }
  if (familyWidth / 2 >= indiWidth) {
    return 0
  }
  return indiWidth - familyWidth / 2
}

/** Returns the vertical size of individual boxes. */
function getIndiVSize(node: GraphNode): number {
  return max([node.indi ? node.indi.height! : 0, node.spouse ? node.spouse.height! : 0])!
}
