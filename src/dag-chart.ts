import { select } from 'd3-selection'
import { max } from 'd3-array'
import { Chart, ChartInfo, ChartOptions, Fam, Indi } from './api'
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

    // validate data without modification
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

    // fix data error
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

    // get node data with ids and sizing
    const nodeDataMap = indis.reduce((m, indi) => {
      this.getGraphNodes(indi.getId()).forEach(n => {
        m.set(n.id, n)
      })
      return m
    }, new Map<string, GraphNode>())
    const nodeDataArray = Array.from(nodeDataMap.values())
    console.log('nodeDataArray ----------->', nodeDataArray)

    // get dag definition and node sizes for calculating layout
    // merge first marriage and additional marriage into a node
    // FIXME: compositeNodes need to be merged again for complex re-marriage cases
    const compositeNodes: {
      id: string
      originIds: string[]
      parentIds: string[]
      width: number
      height: number
    }[] = indis
      .filter(indi => indi.getFamiliesAsSpouse().length > 1)
      .map((indi, index) => {
        const parentIds = Array.from(
          indi.getFamiliesAsSpouse().reduce((pids, fid) => {
            const fatherId = famMap.get(fid)?.getFather()
            const motherId = famMap.get(fid)?.getMother()
            const fatherParent = fatherId ? indiMap.get(fatherId)?.getFamilyAsChild() : undefined
            const motherParent = motherId ? indiMap.get(motherId)?.getFamilyAsChild() : undefined
            fatherParent && pids.add(fatherParent)
            motherParent && pids.add(motherParent)
            return pids
          }, new Set<string>()),
        )
        const width = indi.getFamiliesAsSpouse().reduce((w, fid, index) => {
          return w + nodeDataMap.get(fid)!.width + (index > 0 ? 15 : 0)
        }, 0)
        const height = indi.getFamiliesAsSpouse().reduce((h, fid) => {
          return Math.max(h, nodeDataMap.get(fid)!.height)
        }, 0)
        return {
          id: `composite_${index}`,
          originIds: indi.getFamiliesAsSpouse(),
          parentIds,
          width,
          height,
        }
      })
    const originIdToCompositeIdMap = compositeNodes.reduce((m, cn) => {
      cn.originIds.forEach(originId => {
        m.set(originId, cn.id)
      })
      return m
    }, new Map<string, string>())
    compositeNodes.forEach(cn => {
      const parentIds = new Set<string>()
      cn.parentIds.forEach(parentId => {
        parentIds.add(originIdToCompositeIdMap.get(parentId) || parentId)
      })
      cn.parentIds = Array.from(parentIds)
    })

    console.log('compositionNodes ------------------->', compositeNodes)

    const dagDefinition = (() => {
      const nodeParentsMap = nodeDataArray.reduce((m, node) => {
        if (!originIdToCompositeIdMap.has(node.id)) {
          m.set(node.id, { id: node.id, parentIds: [] })
        }
        return m
      }, new Map<string, { id: string; parentIds: string[] }>())
      compositeNodes.forEach(cn => {
        nodeParentsMap.set(cn.id, { id: cn.id, parentIds: cn.parentIds })
      })
      fams.forEach(f => {
        const nodeId = originIdToCompositeIdMap.get(f.getId()) || f.getId()
        f.getChildren().forEach(c => {
          const n = nodeParentsMap.get(c)
          if (n) {
            n.parentIds = [...n.parentIds, nodeId]
            return
          }
          const indi = indiMap.get(c)
          indi?.getFamiliesAsSpouse().forEach(fid => {
            const familyNode = nodeDataMap.get(fid)
            if (familyNode /* && !familyNode.additionalMarriage */) {
              const nn = nodeParentsMap.get(fid)
              if (nn) {
                nn.parentIds = [...nn.parentIds, nodeId]
              }
            }
          })
        })
      })
      return Array.from(nodeParentsMap.values())
    })()
    console.log('dagDefinition ----------->', dagDefinition)

    const builder = graphStratify()
    const graph = builder(dagDefinition)
    const layout = sugiyama()
      .nodeSize((n: { data: { id: string; parentIds: string[] } }) => {
        const compositeNode = compositeNodes.find(cn => cn.id === n.data.id)
        const { width, height } = (compositeNode || nodeDataMap.get(n.data.id))!
        return [width, height]
      })
      .gap([15, 30])
    layout(graph as unknown as Graph<never, never>)
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

    // set position and generation
    dagNodes.forEach(n => {
      const compositeNode = compositeNodes.find(cn => cn.id === n.data.id)
      if (compositeNode) {
        let offsetX = 0
        for (let i = 0; i < compositeNode.originIds.length; i++) {
          const originId = compositeNode.originIds[i]
          const nodeData = nodeDataMap.get(originId)!
          nodeData.x = n.x - 0.5 * compositeNode.width + 0.5 * nodeData.width + offsetX
          nodeData.y = n.y
          nodeData.generation = yArray.indexOf(n.y)

          offsetX += nodeData.width + 15
        }
      } else {
        const nodeData = nodeDataMap.get(n.data.id)!
        nodeData.x = n.x
        nodeData.y = n.y
        nodeData.generation = yArray.indexOf(n.y)
      }
    })

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
          const node = nodeDataMap.get(indi.getId())
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

    const svg = select(this.options.svgSelector)
    if (svg.select('style').empty()) {
      svg.append('style').text(this.options.renderer.getCss())
    }

    const animationPromise = this.util.renderChart(nodeDataArray, links)
    const info = getChartInfo(nodeDataArray)
    this.util.updateSvgDimensions(info)
    return Object.assign(info, { animationPromise })
  }

  private getGraphNodes(indiId: string): GraphNode[] {
    const indi = this.options.data.getIndi(indiId)!
    const famIds = indi.getFamiliesAsSpouse()
    if (!famIds.length) {
      // Single person.
      const [width, height] = (this.options.renderer as DetailedRenderer).getPreferredIndiSize(indiId)
      const node: GraphNode = {
        id: indiId,
        indi: {
          id: indiId,
          additionalMarriage: false,
          width,
          height,
          anchor: [0, 0],
        },
        width,
        height,
        x: 0, // pending initialization
        y: 0, // pending initialization
        generation: 0, // pending initialization
      }
      node.indi!.anchor = getIndiAnchor(node)
      return [node]
    }
    // Marriages.
    const nodes = famIds.map(famId => {
      const fam = this.options.data.getFam(famId)!
      const father = fam.getFather()
      const mother = fam.getMother()

      const [fatherWidth, fatherHeight] = father
        ? (this.options.renderer as DetailedRenderer).getPreferredIndiSize(father)
        : [0, 0]
      const [motherWidth, motherHeight] = mother
        ? (this.options.renderer as DetailedRenderer).getPreferredIndiSize(mother)
        : [0, 0]
      const fatherMotherHeight = Math.max(fatherHeight, motherHeight)
      const [familyWidth, familyHeight] = (this.options.renderer as DetailedRenderer).getPreferredFamSize(famId)
      const nodeWidth = Math.max(familyWidth, fatherWidth + motherWidth)
      const nodeHeight = familyHeight + fatherMotherHeight

      const node: GraphNode = {
        id: famId,
        indi: fam.getFather()
          ? {
              id: fam.getFather()!,
              additionalMarriage: false,
              width: fatherWidth,
              height: fatherMotherHeight,
              anchor: [0, 0],
            }
          : undefined,
        spouse: fam.getMother()
          ? {
              id: fam.getMother()!,
              additionalMarriage: false,
              width: motherWidth,
              height: fatherMotherHeight,
              anchor: [0, 0],
            }
          : undefined,
        family: {
          id: famId,
          additionalMarriage: false,
          width: familyWidth,
          height: familyHeight,
          anchor: (this.options.renderer as DetailedRenderer).getPreferredFamSize(famId),
        },
        width: nodeWidth,
        height: nodeHeight,
        x: 0, // pending initialization
        y: 0, // pending initialization
        generation: 0, // pending initialization
      }
      node.indi && (node.indi.anchor = getIndiAnchor(node))
      node.spouse && (node.spouse.anchor = getSpouseAnchor(node))
      node.family && (node.family.anchor = getFamilyAnchor(node))
      return node
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
