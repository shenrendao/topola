import { select } from 'd3-selection'
import { max } from 'd3-array'
import { Chart, ChartInfo, ChartOptions, Fam, Indi } from './api'
import { DetailedRenderer } from '.'
import { Graph, graphStratify, sugiyama } from 'd3-dag'
import { DagUtil, GraphLink, GraphNode, H_SPACING, V_SPACING, getChartInfo } from './dag-util'

export class DagChart<IndiT extends Indi, FamT extends Fam> implements Chart {
  readonly util: DagUtil

  private connectedNo: number

  constructor(readonly options: ChartOptions) {
    this.util = new DagUtil(options)
    this.connectedNo = 0
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
        if (n.id === indi.getId()) {
          m.set(n.id, n)
        } else if (m.has(n.id)) {
          if (m.get(n.id)?.indi?.id === indi.getId()) {
            m.get(n.id)!.indi = n.indi
          } else if (m.get(n.id)?.spouse?.id === indi.getId()) {
            m.get(n.id)!.spouse === n.spouse
          }
        } else {
          m.set(n.id, n)
        }
      })
      return m
    }, new Map<string, GraphNode>())
    const nodeDataArray = Array.from(nodeDataMap.values())
    // console.log('nodeDataArray ----------->', nodeDataArray)

    // get dag definition and node sizes for calculating layout
    const dagDefinition = (() => {
      const nodeParentsMap = nodeDataArray.reduce((m, node) => {
        m.set(node.id, { id: node.id, parentIds: [] })
        return m
      }, new Map<string, { id: string; parentIds: string[] }>())
      fams.forEach(f => {
        f.getChildren().forEach(c => {
          const n = nodeParentsMap.get(c)
          if (n) {
            n.parentIds = [...n.parentIds, f.getId()]
            return
          }
          const indi = indiMap.get(c)
          indi?.getFamiliesAsSpouse().forEach(fid => {
            const familyNode = nodeDataMap.get(fid)
            if (familyNode /* && !familyNode.additionalMarriage */) {
              const nn = nodeParentsMap.get(fid)
              if (nn) {
                nn.parentIds = [...nn.parentIds, f.getId()]
              }
            }
          })
        })
      })

      const nodeParentsArray = Array.from(nodeParentsMap.values())

      // set graph connected identifier
      let changed: boolean
      do {
        changed = false
        nodeParentsArray.forEach(nodeParents => {
          const childNode = nodeDataMap.get(nodeParents.id)!
          nodeParents.parentIds.forEach(parentId => {
            const parentNode = nodeDataMap.get(parentId)!
            if (childNode.connectedNo !== parentNode.connectedNo) {
              changed = true
              if (childNode.connectedNo > parentNode.connectedNo) {
                childNode.connectedNo = parentNode.connectedNo
              }
              if (childNode.connectedNo < parentNode.connectedNo) {
                parentNode.connectedNo = childNode.connectedNo
              }
            }
          })
        })
      } while (changed)

      // At this monment, the parent-children relationship has been built.
      // And then re-marriage relationship should be added into the graph.
      const connectionMap = nodeDataArray.reduce((s, n) => {
        s.set(n.connectedNo, [n.connectedNo])
        return s
      }, new Map<number, number[]>())
      indis
        .filter(indi => indi.getFamiliesAsSpouse().length > 1)
        .forEach(indi => {
          const familyNodes = indi.getFamiliesAsSpouse().map(fid => nodeDataMap.get(fid)!)

          let changed: boolean
          do {
            changed = false
            familyNodes.forEach((familyNode, index, array) => {
              if (index === 0) {
                return
              }
              const previousNode = array[index - 1]
              if (
                previousNode.connectedNo !== familyNode.connectedNo &&
                !connectionMap.get(familyNode.connectedNo)!.includes(previousNode.connectedNo)
              ) {
                if (nodeParentsMap.get(familyNode.id)!.parentIds.length > 0) {
                  nodeParentsMap.get(previousNode.id)!.parentIds.push(nodeParentsMap.get(familyNode.id)!.parentIds[0])
                  connectionMap.get(familyNode.connectedNo)!.push(previousNode.connectedNo)
                  connectionMap.get(previousNode.connectedNo)!.push(familyNode.connectedNo)
                  changed = true
                } else if (nodeParentsMap.get(previousNode.id)!.parentIds.length > 0) {
                  nodeParentsMap.get(familyNode.id)!.parentIds.push(nodeParentsMap.get(previousNode.id)!.parentIds[0])
                  connectionMap.get(familyNode.connectedNo)!.push(previousNode.connectedNo)
                  connectionMap.get(previousNode.connectedNo)!.push(familyNode.connectedNo)
                  changed = true
                }
              }
            })
          } while (changed)
        })
      return nodeParentsArray
    })()

    console.log('nodeDataArray ----------->', nodeDataArray)
    console.log('dagDefinition ----------->', dagDefinition)

    const builder = graphStratify()
    const graph = builder(dagDefinition)
    const layout = sugiyama()
      .nodeSize((n: { data: { id: string; parentIds: string[] } }) => {
        const { width, height } = nodeDataMap.get(n.data.id)!
        return [width, height]
      })
      .gap([H_SPACING, V_SPACING])
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
      const nodeData = nodeDataMap.get(n.data.id)!
      nodeData.x = n.x
      nodeData.y = n.y
      nodeData.generation = yArray.indexOf(n.y)
    })

    const lks = fams.reduce((m, fam) => {
      fam.getChildren().forEach(child => {
        const indi = indiMap.get(child)!
        indi.getFamiliesAsSpouse().map(fid => {
          const key = `${fam.getId()}-${fid}`
          if (!m.has(key)) {
            const nodeData = nodeDataMap.get(fid)!
            if (child === nodeData.indi?.id && !nodeData.indi.additionalMarriage) {
              m.set(key, {
                parentId: fam.getId(),
                childId: nodeData.id,
                childIndiSpouseId: child,
              })
            } else if (child === nodeData.spouse?.id && !nodeData.spouse.additionalMarriage) {
              m.set(key, {
                parentId: fam.getId(),
                childId: nodeData.id,
                childIndiSpouseId: child,
              })
            }
          }
        })
        const nodeData = nodeDataMap.get(child)
        if (nodeData) {
          const key = `${fam.getId()}-${child}`
          if (!m.has(key)) {
            m.set(key, {
              parentId: fam.getId(),
              childId: nodeData.id,
              childIndiSpouseId: child,
            })
          }
        }
      })
      return m
    }, new Map<string, GraphLink>())
    const links = Array.from(lks.values())
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
        connectedNo: this.connectedNo++,
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
    const nodes = famIds.map((famId, index) => {
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
        connectedNo: this.connectedNo++,
        id: famId,
        indi: father
          ? {
              id: father,
              additionalMarriage: indiId === father ? index > 0 : undefined,
              width: fatherWidth,
              height: fatherMotherHeight,
              anchor: [0, 0],
            }
          : undefined,
        spouse: mother
          ? {
              id: mother,
              additionalMarriage: indiId === mother ? index > 0 : undefined,
              width: motherWidth,
              height: fatherMotherHeight,
              anchor: [0, 0],
            }
          : undefined,
        family: {
          id: famId,
          additionalMarriage: undefined,
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
