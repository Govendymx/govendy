'use client';

export default function CuentaBloqueadaPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg ring-1 ring-red-100">
                {/* Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 shadow-inner">
                    <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-extrabold text-gray-900">
                    Cuenta Bloqueada
                </h1>

                {/* Description */}
                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                    Tu cuenta ha sido <strong className="text-red-700">bloqueada permanentemente</strong> por
                    incumplimiento de las reglas de la plataforma.
                </p>
                <p className="mt-3 text-sm text-gray-500">
                    Ya no puedes iniciar sesión ni realizar operaciones en GoVendy.
                </p>

                {/* Divider */}
                <div className="my-6 border-t border-gray-200" />

                {/* Support info */}
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-700">
                        ¿Crees que es un error?
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        Escríbenos a{' '}
                        <a
                            href="mailto:soporte@gopocket.com.mx"
                            className="font-semibold text-orange-600 underline hover:text-orange-700"
                        >
                            soporte@gopocket.com.mx
                        </a>
                    </p>
                </div>

                {/* Back to home */}
                <a
                    href="/"
                    className="mt-6 inline-block rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 hover:shadow-md"
                >
                    Ir al Inicio
                </a>
            </div>
        </div>
    );
}
