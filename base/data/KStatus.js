
import Enum from 'easy-enums';

/**
 * DRAFT PUBLISHED MODIFIED REQUEST_PUBLISH PENDING ARCHIVED TRASH ALL_BAR_TRASH PUB_OR_ARC PUB_OR_DRAFT
 * 
 * NB: PUBLISHED -> MODIFIED on edit is set by the server (see AppUtils.java doSaveEdit(), or trace usage of KStatus.MODIFIED)
 * 
 * Beware of the OR options like PUB_OR_DRAFT! Data-corruption bug seen Oct 2022, with published data over-writing into a draft object via that route.
 */
const KStatus = new Enum('DRAFT PUBLISHED MODIFIED REQUEST_PUBLISH PENDING ARCHIVED TRASH ALL_BAR_TRASH PUB_OR_ARC PUB_OR_DRAFT');

export default KStatus;
