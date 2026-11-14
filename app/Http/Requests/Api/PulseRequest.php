<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PulseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'since' => ['nullable', 'date'],
            'mode' => ['required', Rule::in(['ghost', 'coffin', 'living'])],
            'zone_phase_id' => ['nullable', 'integer', 'exists:zone_phases,id'],
            'cell' => ['nullable', 'integer', 'min:0', 'max:59'],
            'viewing_tomb_id' => ['nullable', 'integer', 'exists:tombs,id'],
        ];
    }
}
