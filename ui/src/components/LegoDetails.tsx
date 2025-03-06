import React from 'react';
import { Lego } from '../types/lego';

interface LegoDetailsProps {
    lego: Lego & {
        logicalLegs: number[];
        physicalLegs: number[];
    };
    onClose: () => void;
    onLegToggle: (legIndex: number, isLogical: boolean) => void;
}

export const LegoDetails: React.FC<LegoDetailsProps> = ({ lego, onClose, onLegToggle }) => {
    const getNumLegs = (lego: Lego) => {
        if (!lego.parity_check_matrix || lego.parity_check_matrix.length === 0) {
            return 0;
        }
        return lego.parity_check_matrix[0].length;
    };

    const numLegs = getNumLegs(lego);

    return (
        <div className="w-80 bg-white p-6 shadow-lg border-l border-gray-200 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">{lego.name}</h3>
                    <p className="text-sm text-gray-500">{lego.type}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    ✕
                </button>
            </div>

            <div className="space-y-6">
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Parity Check Matrix</h4>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <pre className="text-sm overflow-x-auto font-mono">
                            {lego.parity_check_matrix ? JSON.stringify(lego.parity_check_matrix, null, 2) : 'No matrix available'}
                        </pre>
                    </div>
                </div>

                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Legs</h4>
                    <div className="space-y-3">
                        {Array.from({ length: numLegs }).map((_, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="text-sm font-medium text-gray-700">Leg {index + 1}</span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onLegToggle(index, true)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${lego.logicalLegs.includes(index)
                                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Logical
                                    </button>
                                    <button
                                        onClick={() => onLegToggle(index, false)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${lego.physicalLegs.includes(index)
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Physical
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}; 