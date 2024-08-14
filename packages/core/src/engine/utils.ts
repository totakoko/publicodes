import Engine from '.'
import { Situation } from '..'
import { parseExpression } from '../parseExpression'

/**
 * Check if the value from a mutliple choices question `dottedName`
 * is defined as a rule `dottedName . value` in the model.
 * If not, the value in the situation is an old option,
 * that is not an option anymore.
 *  */
export function isAValidOption<Name extends string>(
	engine: Engine<Name>,
	dottedName: Name,
	value: Situation<Name>[Name],
) {
	// original: https://github.com/publicodes/publicodes/blob/946d98d1b4fb77b6f9a48ccb16d658816e6701df/packages/core/src/engine/utils.ts
	// updated to work with options
	if (typeof value === 'number') {
		return true
	}

	const parsedSituationExpr =
		typeof value === 'string' ? parseExpression(value, dottedName) : undefined
	const parsedRules = engine.getParsedRules()
	const compareValue =
		parsedSituationExpr && 'constant' in parsedSituationExpr ?
			parsedSituationExpr.constant.type === 'boolean' ?
				value
			:	`'${parsedSituationExpr.constant.nodeValue}'`
		:	(parsedSituationExpr as any).variable
	const options =
		(
			parsedRules[dottedName].rawNode?.['une possibilit\xE9'] ??
			parsedRules[dottedName].rawNode?.formule?.['une possibilit\xE9'] ??
			parsedRules[dottedName].rawNode?.valeur?.['une possibilit\xE9'] ??
			parsedRules[dottedName].rawNode?.['par défaut']?.['une possibilit\xE9']
		)?.possibilités ?? []

	return (
		options.length === 0 ||
		options.some((option) => option === compareValue) ||
		`${dottedName} . ${(parsedSituationExpr as any).variable}` in parsedRules
	)
}
