<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTombRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $year = (int) now()->year;

        return [
            'name' => ['required', 'string', new MaxChars(8)],
            'birth_year' => ['required', 'integer', 'min:1900', 'max:'.$year],
            'cause' => ['required', 'string', new MaxChars(12)],
            'portrait' => ['required', 'integer', 'min:0', 'max:5'],
            'last_words' => ['nullable', 'string', new MaxChars(40)],
            'style' => ['required', Rule::in(config('afterme.tomb_styles'))],
            'plot' => ['required', 'integer', 'min:0'],
            'epitaph' => ['required', 'string', new MaxChars(40)],
            'eulogy' => ['required', 'string'],
            'verdict' => ['required', 'string', new MaxChars(16)],
            'couplet' => ['required', 'integer', 'min:0', 'max:255'],
        ];
    }
}
