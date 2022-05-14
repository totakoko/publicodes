import { EvaluationFunction } from '..'
import { ASTNode } from '../AST/types'
import { convertToDate } from '../date'
import { warning } from '../error'
import { mergeAllMissing } from '../evaluation'
import { registerEvaluationFunction } from '../evaluationFunctions'
import { convertNodeToUnit } from '../nodeUnits'
import parse from '../parse'
import { inferUnit, serializeUnit } from '../units'

const knownOperations = {
	'*': [(a, b) => a * b, '×'],
	'/': [(a, b) => (b === 0 ? null : a / b), '∕'],
	'+': [(a, b) => a + b],
	'-': [(a, b) => a - b, '−'],
	'<': [(a, b) => a < b],
	'<=': [(a, b) => a <= b, '≤'],
	'>': [(a, b) => a > b],
	'>=': [(a, b) => a >= b, '≥'],
	'=': [(a, b) => (a ?? false) === (b ?? false)],
	'!=': [(a, b) => (a ?? false) !== (b ?? false), '≠'],
	et: [(a, b) => (a ?? false) && (b ?? false)],
	ou: [(a, b) => (a ?? false) || (b ?? false)],
} as const

export type OperationNode = {
	nodeKind: 'operation'
	explanation: [ASTNode, ASTNode]
	operationKind: keyof typeof knownOperations
	operator: string
}

const parseOperation = (k, symbol) => (v, context) => {
	const explanation = v.map((node) => parse(node, context))

	return {
		...v,
		nodeKind: 'operation',
		operationKind: k,
		operator: symbol || k,
		explanation,
	} as OperationNode
}

const evaluate: EvaluationFunction<'operation'> = function (node) {
	let node1 = this.evaluate(node.explanation[0])
	let evaluatedNode = {
		...node,
	}

	// LAZY EVALUATION
	if (
		(node1.nodeValue === null &&
			['<=', '>=', '/', '*', '-', 'et'].includes(node.operationKind)) ||
		(node1.nodeValue === 0 && ['/', '*'].includes(node.operationKind)) ||
		(node1.nodeValue === false && node.operationKind === 'et') ||
		(node1.nodeValue === true && node.operationKind === 'ou')
	) {
		return {
			...evaluatedNode,
			nodeValue: node.operationKind === 'et' ? false : node1.nodeValue,
			missingVariables: node1.missingVariables,
		}
	}

	let node2 = this.evaluate(node.explanation[1])
	evaluatedNode.explanation = [node1, node2]

	// LAZY EVALUATION 2
	if (
		(node2.nodeValue === null &&
			['<=', '>=', '/', '*', 'et'].includes(node.operationKind)) ||
		(node2.nodeValue === 0 && ['*'].includes(node.operationKind)) ||
		(node2.nodeValue === false && node.operationKind === 'et') ||
		(node2.nodeValue === true && node.operationKind === 'ou')
	) {
		return {
			...evaluatedNode,
			nodeValue: node.operationKind === 'et' ? false : node2.nodeValue,
			missingVariables: node2.missingVariables,
		}
	}

	evaluatedNode.missingVariables = mergeAllMissing([node1, node2])

	if (node1.nodeValue === undefined || node2.nodeValue === undefined) {
		evaluatedNode = {
			...evaluatedNode,
			nodeValue: undefined,
		}
	}

	const isAdditionOrSubstractionWithPercentage =
		['+', '-'].includes(node.operationKind) &&
		serializeUnit(node2.unit) === '%' &&
		serializeUnit(node1.unit) !== '%'

	if (
		!('nodeValue' in evaluatedNode) &&
		!['/', '*'].includes(node.operationKind) &&
		!isAdditionOrSubstractionWithPercentage
	) {
		try {
			if (node1.unit && 'unit' in node2) {
				node2 = convertNodeToUnit(node1.unit, node2)
			} else if (node2.unit) {
				node1 = convertNodeToUnit(node2.unit, node1)
			}
		} catch (e) {
			warning(
				this.options.logger,
				`Dans l'expression '${
					node.operationKind
				}', la partie gauche (unité: ${serializeUnit(
					node1.unit
				)}) n'est pas compatible avec la partie droite (unité: ${serializeUnit(
					node2.unit
				)})`,
				e
			)
		}
	}

	const operatorFunction = knownOperations[node.operationKind][0]

	const a = node1.nodeValue as string | boolean | null
	const b = node2.nodeValue as string | boolean | null

	evaluatedNode.nodeValue =
		'nodeValue' in evaluatedNode
			? evaluatedNode.nodeValue
			: ['<', '>', '<=', '>=', '*', '/'].includes(node.operationKind) &&
			  node2.nodeValue === null
			? null
			: [a, b].every(
					(value) =>
						typeof value === 'string' &&
						value.match?.(/[\d]{2}\/[\d]{2}\/[\d]{4}/)
			  )
			? operatorFunction(convertToDate(a), convertToDate(b))
			: operatorFunction(a, b)

	if (
		node.operationKind === '*' &&
		inferUnit('*', [node1.unit, node2.unit])?.numerators.includes('%')
	) {
		let unit = inferUnit('*', [node1.unit, node2.unit])
		return {
			...evaluatedNode,
			nodeValue: evaluatedNode.nodeValue / 100,
			unit: inferUnit('*', [unit, { numerators: [], denominators: ['%'] }]),
		}
	}
	// Addition or substraction of scalar with a percentage is a multiplication
	if (isAdditionOrSubstractionWithPercentage) {
		let unit = inferUnit('*', [node1.unit, node2.unit])
		return {
			...evaluatedNode,
			nodeValue:
				node1.nodeValue *
				(1 + (node2.nodeValue / 100) * (node.operationKind === '-' ? -1 : 1)),
			unit: inferUnit('*', [unit, { numerators: [], denominators: ['%'] }]),
		}
	}

	if (
		node.operationKind === '*' ||
		node.operationKind === '/' ||
		node.operationKind === '-' ||
		node.operationKind === '+'
	) {
		return {
			...evaluatedNode,
			unit: inferUnit(node.operationKind, [node1.unit, node2.unit]),
		}
	}

	return evaluatedNode
}

registerEvaluationFunction('operation', evaluate)

const operationDispatch = Object.fromEntries(
	Object.entries(knownOperations).map(([k, [f, symbol]]) => [
		k,
		parseOperation(k, symbol),
	])
)

export default operationDispatch
